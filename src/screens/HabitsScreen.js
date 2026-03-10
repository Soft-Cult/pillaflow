
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  TextInput,
  Alert,
  Switch,
  Platform,
  useWindowDimensions,
  Modal as RNModal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import {
  Card,
  Modal,
  ChipGroup,
  PlatformScrollView,
  PlatformDatePicker,
} from '../components';
import HabitsHowToOverlay from '../components/HabitsHowToOverlay';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, borderRadius, spacing, typography, shadows, habitCategories } from '../utils/theme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_RANGE_OPTIONS = [
  { label: 'All Day', value: 'all_day' },
  { label: 'Morning', value: 'morning' },
  { label: 'Afternoon', value: 'afternoon' },
  { label: 'Evening', value: 'evening' },
];
const HABIT_VIEW_FILTERS = ['All', 'Personal', 'Group', 'Build habits', 'Quit habits', 'Achieved'];
const GOAL_PERIOD_OPTIONS = [
  { label: 'Daily', value: 'day' },
  { label: 'Weekly', value: 'week' },
  { label: 'Monthly', value: 'month' },
];
const DEFAULT_QUIT_GOAL_DAYS_PLACEHOLDER = '30';
const GOAL_UNIT_CATEGORY_OPTIONS = [
  { label: 'Quantity', value: 'quantity' },
  { label: 'Time', value: 'time' },
];
const GOAL_UNIT_PRESETS = {
  quantity: ['count', 'times', 'steps', 'm', 'km', 'mile', 'ml', 'oz', 'Cal', 'g', 'mg', 'drink', 'time'],
  time: ['sec', 'min', 'hr'],
};
const HABIT_COMPLETION_METHODS = [
  {
    value: 'swipe',
    label: 'Swipe completion',
    description: 'Swipe right on a habit card to add progress.',
    icon: 'swap-horizontal',
  },
  {
    value: 'manual_plus',
    label: 'Manual + button',
    description: 'Use the + button on each habit card to add progress.',
    icon: 'add-circle',
  },
];
const HABIT_COLOR_OPTIONS = [
  '#9B59B6',
  '#3B82F6',
  '#10B981',
  '#F97316',
  '#EF4444',
  '#14B8A6',
  '#E11D48',
  '#8B5CF6',
];
const HABIT_EMOJI_OPTIONS = [
  '\u{1F600}',
  '\u{1F60C}',
  '\u{1F4AA}',
  '\u{1F3C3}',
  '\u{1F9D8}',
  '\u{1F4DA}',
  '\u{1F4BC}',
  '\u{1F3AF}',
  '\u{1F9E0}',
  '\u{1F4DD}',
  '\u{1F4A7}',
  '\u{1F34E}',
  '\u{1F957}',
  '\u2600\uFE0F',
  '\u{1F319}',
  '\u{1F6CC}',
  '\u{1F3B5}',
  '\u{1F9F9}',
  '\u{1F48A}',
  '\u2764\uFE0F',
  '\u{1F525}',
  '\u2728',
  '\u2705',
  '\u{1F4C8}',
];
const DAY_INDEX_TO_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const toISODate = (date) => (date instanceof Date ? date : new Date(date || Date.now())).toISOString().slice(0, 10);
const toDateKey = (date) => (date instanceof Date ? date : new Date(date || Date.now())).toDateString();
const addDays = (date, amount) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};
const isSameDay = (a, b) => toDateKey(a) === toDateKey(b);
const parseNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};
const parsePositiveIntOrNull = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const normalized = Math.trunc(numeric);
  return normalized > 0 ? normalized : null;
};
const sanitizeGoalUnit = (value, fallback = 'times') => {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  return normalized || fallback;
};
const normalizeHabitCompletionMethod = (value) =>
  String(value || 'swipe').toLowerCase() === 'manual_plus' ? 'manual_plus' : 'swipe';
const getHabitSwipeStepAmount = (goalValue = 1) => {
  const normalizedGoal = Math.max(1, parseNumber(goalValue, 1));
  if (Number.isInteger(normalizedGoal)) return 1;
  return normalizedGoal <= 5 ? 0.1 : 0.5;
};
const inferGoalUnitCategory = (unitValue) => {
  const normalizedUnit = sanitizeGoalUnit(unitValue, '').toLowerCase();
  const inTimeUnits = (GOAL_UNIT_PRESETS.time || []).some(
    (unit) => unit.toLowerCase() === normalizedUnit
  );
  return inTimeUnits ? 'time' : 'quantity';
};
const toStartOfDay = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return new Date(new Date().toDateString());
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
const toUtcDayNumber = (value) => {
  const date = toStartOfDay(value);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
};
const parseDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]) - 1;
      const day = Number(isoMatch[3]);
      const parsed = new Date(year, month, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toStartOfDay(parsed);
};
const formatDisplayDate = (value, fallback = 'Not set') => {
  const parsed = parseDateOnly(value);
  if (!parsed) return fallback;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
const getInclusiveDaySpan = (startValue, endValue) => {
  const startDate = parseDateOnly(startValue);
  const endDate = parseDateOnly(endValue);
  if (!startDate || !endDate) return null;
  const startDay = toUtcDayNumber(startDate);
  const endDay = toUtcDayNumber(endDate);
  if (!Number.isFinite(startDay) || !Number.isFinite(endDay) || endDay < startDay) return null;
  return endDay - startDay + 1;
};
const normalizeWeekdayToken = (value) => {
  const token = String(value || '').trim().slice(0, 3).toLowerCase();
  const map = {
    sun: 'Sun',
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
  };
  return map[token] || null;
};
const extractWeekdaySet = (values = []) => {
  const set = new Set();
  (values || []).forEach((value) => {
    const token = normalizeWeekdayToken(value);
    if (token) set.add(token);
  });
  return set;
};
const extractMonthDaySet = (habit = {}) => {
  const values = [
    ...(Array.isArray(habit?.monthDays) ? habit.monthDays : []),
    ...(Array.isArray(habit?.days) ? habit.days : []),
  ];
  const set = new Set();
  values.forEach((value) => {
    const next = Number(value);
    const day = Math.trunc(next);
    if (Number.isFinite(day) && day >= 1 && day <= 31) set.add(day);
  });
  return set;
};
const hasHabitReachedEndDate = (habit, referenceDateValue = new Date()) => {
  if (!habit?.endDate) return false;
  const endDate = parseDateOnly(habit.endDate);
  const referenceDate = parseDateOnly(referenceDateValue);
  if (!endDate || !referenceDate) return false;
  return toUtcDayNumber(referenceDate) >= toUtcDayNumber(endDate);
};
const isHabitScheduledForDate = (habit, dateValue) => {
  if (!habit) return false;
  const targetDate = toStartOfDay(dateValue);
  const targetDayNumber = toUtcDayNumber(targetDate);
  const startDate = parseDateOnly(habit.startDate) || parseDateOnly(habit.createdAt);
  const endDate = parseDateOnly(habit.endDate);

  if (startDate && targetDayNumber < toUtcDayNumber(startDate)) return false;
  if (endDate && targetDayNumber > toUtcDayNumber(endDate)) return false;

  const taskDaysMode = habit.taskDaysMode || 'every_day';
  if (taskDaysMode === 'specific_weekdays') {
    const weekdaySet = extractWeekdaySet(habit.days || []);
    if (!weekdaySet.size) return true;
    return weekdaySet.has(DAY_INDEX_TO_LABEL[targetDate.getDay()]);
  }

  if (taskDaysMode === 'specific_month_days') {
    const monthDaySet = extractMonthDaySet(habit);
    if (!monthDaySet.size) return true;
    return monthDaySet.has(targetDate.getDate());
  }

  const repeat = String(habit.repeat || '').toLowerCase();
  if (repeat === 'weekly') {
    const weekdaySet = extractWeekdaySet(habit.days || []);
    if (weekdaySet.size) return weekdaySet.has(DAY_INDEX_TO_LABEL[targetDate.getDay()]);
    if (startDate) return startDate.getDay() === targetDate.getDay();
  }
  if (repeat === 'monthly') {
    const monthDaySet = extractMonthDaySet(habit);
    if (monthDaySet.size) return monthDaySet.has(targetDate.getDate());
    if (startDate) return startDate.getDate() === targetDate.getDate();
  }

  return true;
};
const parseTimeStringToDate = (value) => {
  const result = new Date();
  if (!value || typeof value !== 'string') return result;

  const [timePart, suffixRaw] = value.trim().split(' ');
  if (!timePart) return result;

  const [hourRaw, minuteRaw] = timePart.split(':');
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw) || 0;
  if (Number.isNaN(hour)) return result;

  const suffix = (suffixRaw || '').toUpperCase().replace(/[^APM]/g, '');
  if (suffix === 'PM' && hour < 12) hour += 12;
  if (suffix === 'AM' && hour === 12) hour = 0;

  result.setHours(clamp(hour, 0, 23), clamp(minute, 0, 59), 0, 0);
  return result;
};
const withAlpha = (hexColor, alpha = 0.15) => {
  if (!hexColor || typeof hexColor !== 'string') return `rgba(155,89,182,${alpha})`;
  const clean = hexColor.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
  if (full.length !== 6) return `rgba(155,89,182,${alpha})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
};
const shadeColor = (hexColor, amount = 0) => {
  const clean = (hexColor || '#9B59B6').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
  const base = full.length === 6 ? full : '9B59B6';
  const toChannel = (index) => {
    const raw = parseInt(base.slice(index, index + 2), 16);
    const next = Math.round(raw + amount * 255);
    return clamp(next, 0, 255);
  };
  const r = toChannel(0).toString(16).padStart(2, '0');
  const g = toChannel(2).toString(16).padStart(2, '0');
  const b = toChannel(4).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};
const getReadableTextColor = (hexColor) => {
  const clean = (hexColor || '#9B59B6').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
  const base = full.length === 6 ? full : '9B59B6';
  const toLinear = (value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const r = parseInt(base.slice(0, 2), 16);
  const g = parseInt(base.slice(2, 4), 16);
  const b = parseInt(base.slice(4, 6), 16);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance < 0.43 ? '#F8FAFC' : '#111827';
};
const parseColorToRgba = (value) => {
  if (!value || typeof value !== 'string') return null;
  const source = value.trim();
  if (!source) return null;

  const hex = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const clean = hex[1];
    const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgb = source.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1]
      .split(',')
      .map((part) => part.trim())
      .map((part) => Number(part));
    if (parts.length < 3 || parts.slice(0, 3).some((part) => Number.isNaN(part))) return null;
    return {
      r: clamp(Math.round(parts[0]), 0, 255),
      g: clamp(Math.round(parts[1]), 0, 255),
      b: clamp(Math.round(parts[2]), 0, 255),
      a: parts.length >= 4 && Number.isFinite(parts[3]) ? clamp(parts[3], 0, 1) : 1,
    };
  }

  return null;
};
const toSolidColor = (value, backdrop = '#FFFFFF') => {
  const foreground = parseColorToRgba(value);
  if (!foreground) return null;
  const alpha = Number.isFinite(foreground.a) ? clamp(foreground.a, 0, 1) : 1;
  if (alpha >= 0.999) {
    return { r: foreground.r, g: foreground.g, b: foreground.b };
  }

  const backgroundSolid = toSolidColor(backdrop, '#FFFFFF') || { r: 255, g: 255, b: 255 };
  return {
    r: Math.round(foreground.r * alpha + backgroundSolid.r * (1 - alpha)),
    g: Math.round(foreground.g * alpha + backgroundSolid.g * (1 - alpha)),
    b: Math.round(foreground.b * alpha + backgroundSolid.b * (1 - alpha)),
  };
};
const toRelativeLuminance = ({ r, g, b }) => {
  const toLinear = (value) => {
    const channel = clamp(value, 0, 255) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};
const getContrastRatio = (foreground, background) => {
  const l1 = toRelativeLuminance(foreground);
  const l2 = toRelativeLuminance(background);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
};
const resolveContrastColor = ({
  preferredColor,
  backgroundColor,
  fallbackColor,
  backgroundBaseColor = '#FFFFFF',
  minContrast = 2.5,
}) => {
  const preferred = toSolidColor(preferredColor, '#FFFFFF');
  const background = toSolidColor(backgroundColor, backgroundBaseColor) || toSolidColor(backgroundBaseColor, '#FFFFFF');
  const fallback = toSolidColor(fallbackColor, '#FFFFFF');
  if (!preferred || !background) return preferredColor;

  const preferredRatio = getContrastRatio(preferred, background);
  if (preferredRatio >= minContrast) return preferredColor;

  if (!fallback) return preferredColor;
  const fallbackRatio = getContrastRatio(fallback, background);
  return fallbackRatio > preferredRatio ? fallbackColor : preferredColor;
};
const toOpaqueColor = (value, backdrop = '#FFFFFF') => {
  const solid = toSolidColor(value, backdrop);
  if (!solid) return value;
  return `rgb(${solid.r},${solid.g},${solid.b})`;
};

const withDefaults = (habit) => ({
  ...habit,
  habitType: habit?.habitType || 'build',
  goalPeriod: habit?.goalPeriod || 'day',
  goalValue: parseNumber(habit?.goalValue, 1) || 1,
  goalUnit: habit?.goalUnit || 'times',
  timeRange: habit?.timeRange || 'all_day',
  taskDaysMode: habit?.taskDaysMode || 'every_day',
  taskDaysCount: parseNumber(habit?.taskDaysCount, 3),
  monthDays: Array.isArray(habit?.monthDays) ? habit.monthDays : [],
  remindersEnabled: Boolean(habit?.remindersEnabled),
  reminderTimes: Array.isArray(habit?.reminderTimes) ? habit.reminderTimes : [],
  reminderMessage: habit?.reminderMessage || '',
  showMemoAfterCompletion: Boolean(habit?.showMemoAfterCompletion),
  chartType: habit?.chartType || 'bar',
  startDate: habit?.startDate || toISODate(new Date()),
  endDate: habit?.endDate || null,
  color: habit?.color || habit?.habitColor || colors.habits,
  emoji: typeof habit?.emoji === 'string' ? habit.emoji : '',
});

const getGoalValue = (habit) => Math.max(1, parseNumber(habit?.goalValue, 1));

const getDateProgressAmount = (habit, dateKey, localMap) => {
  const key = `${habit.id}|${dateKey}`;
  if (Object.prototype.hasOwnProperty.call(localMap, key)) {
    return parseNumber(localMap[key], 0);
  }
  const map = habit.progressByDate || {};
  if (Object.prototype.hasOwnProperty.call(map, dateKey)) return parseNumber(map[dateKey], 0);
  if ((habit.completedDates || []).includes(dateKey)) return getGoalValue(habit);
  return 0;
};

const getCompletionRatio = (habit, amount, referenceDate = new Date()) => {
  if (hasHabitReachedEndDate(habit, referenceDate)) return 1;
  const goal = getGoalValue(habit);
  if ((habit?.habitType || 'build') === 'quit') {
    if (amount <= goal) return 1;
    return clamp(1 - (amount - goal) / goal, 0, 1);
  }
  return clamp(amount / goal, 0, 1);
};

const isCompletedForDate = (habit, dateKey, amount) => {
  if (hasHabitReachedEndDate(habit, dateKey)) return true;
  if ((habit?.habitType || 'build') === 'quit') {
    return amount <= getGoalValue(habit);
  }
  if ((habit.completedDates || []).includes(dateKey)) return true;
  return amount >= getGoalValue(habit);
};

const formatTaskDaysSummary = ({ taskDaysMode, taskDaysCount, days, monthDays }) => {
  if (taskDaysMode === 'specific_weekdays') return days.length ? days.join(' ') : 'Select weekdays';
  if (taskDaysMode === 'days_per_week') return `${taskDaysCount} days/week`;
  if (taskDaysMode === 'specific_month_days')
    return monthDays.length ? monthDays.slice().sort((a, b) => a - b).join(', ') : 'Select days';
  if (taskDaysMode === 'days_per_month') return `${taskDaysCount} days/month`;
  return 'Every day';
};
const normalizeStreakGoalPeriod = (value) => {
  const normalized = String(value || 'day').toLowerCase();
  if (normalized === 'week' || normalized === 'month') return normalized;
  return 'day';
};
const getStreakPeriodIndex = (value, goalPeriod = 'day') => {
  const period = normalizeStreakGoalPeriod(goalPeriod);
  const date = toStartOfDay(value);
  if (Number.isNaN(date.getTime())) return null;
  if (period === 'month') return date.getFullYear() * 12 + date.getMonth();
  const dayNumber = toUtcDayNumber(date);
  if (!Number.isFinite(dayNumber)) return null;
  if (period === 'week') return Math.floor((dayNumber + 3) / 7);
  return dayNumber;
};
const getStreakUnit = (goalPeriod = 'day', plural = false) => {
  const period = normalizeStreakGoalPeriod(goalPeriod);
  if (period === 'week') return plural ? 'weeks' : 'week';
  if (period === 'month') return plural ? 'months' : 'month';
  return plural ? 'days' : 'day';
};
const formatStreakSummary = (streak = 0, goalPeriod = 'day') =>
  `${streak} ${getStreakUnit(goalPeriod)} streak`;
const computeCurrentStreakFromDateKeys = (dateKeys = [], goalPeriod = 'day', referenceDate = new Date()) => {
  const indices = Array.from(
    new Set(
      (dateKeys || [])
        .map((value) => getStreakPeriodIndex(value, goalPeriod))
        .filter((index) => Number.isFinite(index))
    )
  ).sort((a, b) => a - b);
  if (!indices.length) return 0;

  const currentPeriodIndex = getStreakPeriodIndex(referenceDate, goalPeriod);
  if (!Number.isFinite(currentPeriodIndex)) return 0;

  const latestCompletedPeriod = indices[indices.length - 1];
  if (currentPeriodIndex - latestCompletedPeriod > 1) return 0;

  const indexSet = new Set(indices);
  let streak = 0;
  let cursor = latestCompletedPeriod;
  while (indexSet.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
};
const computeBestStreakFromDateKeys = (dateKeys = [], goalPeriod = 'day') => {
  const indices = Array.from(
    new Set(
      (dateKeys || [])
        .map((value) => getStreakPeriodIndex(value, goalPeriod))
        .filter((index) => Number.isFinite(index))
    )
  ).sort((a, b) => a - b);

  if (!indices.length) return 0;

  let best = 1;
  let current = 1;
  for (let index = 1; index < indices.length; index += 1) {
    if (indices[index] - indices[index - 1] === 1) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
};

const SwipeHabitCard = ({
  habit,
  progress,
  ratio,
  completed,
  achieved = false,
  overdone = false,
  streakFrozen = false,
  freezeEligible = false,
  isInteractive,
  swipeGesturesEnabled = true,
  onTap,
  onEdit,
  onSkip,
  onReset,
  onDelete,
  onSwipeAdd,
  onQuickAdd,
  completionMethod = 'swipe',
  onSwipeInteractionChange,
  styles,
  palette,
}) => {
  const actionTileCount = achieved ? 2 : 3;
  const ACTION_RAIL_WIDTH = spacing.sm + actionTileCount * (64 + spacing.sm);
  const FILL_SWIPE_DISTANCE = 220;
  const PROGRESS_ACTIVATION_DISTANCE = 12;
  const SWIPE_CAPTURE_DISTANCE = 10;
  const HORIZONTAL_INTENT_RATIO = 1.1;
  const ACTION_DRAG_DAMPING = 0.88;
  const ACTION_OPEN_DISTANCE = 74;
  const ACTION_OPEN_VELOCITY = -0.62;
  const ACTION_CLOSE_DISTANCE = 52;
  const ACTION_CLOSE_VELOCITY = 0.55;
  const PROGRESS_COMMIT_DISTANCE = 18;
  const PROGRESS_STEP_PIXELS_MIN = 12;
  const PROGRESS_STEP_PIXELS_MAX = 44;
  const PROGRESS_STEP_CALIBRATION_WINDOW = 12;
  const PROGRESS_EASING = 1.18;
  const goalValue = getGoalValue(habit);
  const swipeStepAmount = getHabitSwipeStepAmount(goalValue);
  const swipeStepPrecision =
    swipeStepAmount >= 1 ? 0 : Math.min(3, String(swipeStepAmount).split('.')[1]?.length || 1);
  const { width: windowWidth } = useWindowDimensions();
  const rowWidth = Math.max(1, windowWidth - spacing.lg * 2);
  const resolvedCompletionMethod = normalizeHabitCompletionMethod(completionMethod);
  const manualPlusEnabled = resolvedCompletionMethod === 'manual_plus';
  const canSwipeProgress = swipeGesturesEnabled && isInteractive && !achieved && !manualPlusEnabled;
  const canSwipeActions = swipeGesturesEnabled && (isInteractive || achieved);
  const translateX = useRef(new Animated.Value(0)).current;
  const [actionsOpen, setActionsOpen] = useState(false);
  const [dragFillRatio, setDragFillRatio] = useState(0);
  const dragFillRatioRef = useRef(0);
  const swipeStartAmountRef = useRef(Math.max(0, parseNumber(progress, 0)));
  const currentAmountRef = useRef(Math.max(0, parseNumber(progress, 0)));
  const swipeModeRef = useRef('idle');
  const swipeActiveRef = useRef(false);
  const fillRafRef = useRef(null);
  const fillResetTimeoutRef = useRef(null);
  const streakPopScale = useRef(new Animated.Value(1)).current;
  const previousStreakRef = useRef(Math.max(0, Number(habit?.streak) || 0));

  useEffect(() => {
    currentAmountRef.current = Math.max(0, parseNumber(progress, 0));
  }, [progress]);

  useEffect(() => {
    const nextStreak = Math.max(0, Number(habit?.streak) || 0);
    const previousStreak = previousStreakRef.current;
    if (nextStreak > previousStreak) {
      streakPopScale.stopAnimation();
      streakPopScale.setValue(0.97);
      Animated.sequence([
        Animated.timing(streakPopScale, {
          toValue: 1.045,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(streakPopScale, {
          toValue: 1,
          tension: 180,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    }
    previousStreakRef.current = nextStreak;
  }, [habit?.streak, streakPopScale]);

  const getSwipeTargetAmount = useCallback(
    (dx, startAmount = swipeStartAmountRef.current) => {
      const clampedStart = clamp(parseNumber(startAmount, 0), 0, goalValue);
      if (dx <= PROGRESS_ACTIVATION_DISTANCE) return clampedStart;

      const adjustedDistance = Math.max(0, dx - PROGRESS_ACTIVATION_DISTANCE);
      const remaining = Math.max(0, goalValue - clampedStart);
      if (remaining <= 0) return goalValue;

      const remainingSteps = Math.max(1, Math.ceil(remaining / swipeStepAmount));
      const calibratedStepCount = Math.max(
        1,
        Math.min(remainingSteps, PROGRESS_STEP_CALIBRATION_WINDOW)
      );
      const stepPixelDistance = clamp(
        FILL_SWIPE_DISTANCE / calibratedStepCount,
        PROGRESS_STEP_PIXELS_MIN,
        PROGRESS_STEP_PIXELS_MAX
      );
      const easedDistance = adjustedDistance ** PROGRESS_EASING;
      const easedStepPixels = stepPixelDistance ** PROGRESS_EASING;
      const stepCount = Math.floor((easedDistance + easedStepPixels * 0.08) / easedStepPixels);
      const steppedDelta = stepCount * swipeStepAmount;
      const nextAmount = clamp(clampedStart + steppedDelta, clampedStart, goalValue);
      return Number(nextAmount.toFixed(swipeStepPrecision));
    },
    [
      FILL_SWIPE_DISTANCE,
      PROGRESS_ACTIVATION_DISTANCE,
      PROGRESS_STEP_CALIBRATION_WINDOW,
      PROGRESS_STEP_PIXELS_MAX,
      PROGRESS_STEP_PIXELS_MIN,
      PROGRESS_EASING,
      goalValue,
      swipeStepAmount,
      swipeStepPrecision,
    ]
  );

  const getSwipePreviewRatio = useCallback(
    (dx, startAmount = swipeStartAmountRef.current) => {
      const clampedStart = clamp(parseNumber(startAmount, 0), 0, goalValue);
      if (dx <= 0) return goalValue > 0 ? clamp(clampedStart / goalValue, 0, 1) : 0;
      const adjustedDistance = Math.max(0, dx - PROGRESS_ACTIVATION_DISTANCE);
      const remaining = Math.max(0, goalValue - clampedStart);
      if (remaining <= 0) return 1;
      const swipeProgress = clamp(adjustedDistance / FILL_SWIPE_DISTANCE, 0, 1) ** PROGRESS_EASING;
      const previewAmount = clampedStart + swipeProgress * remaining;
      return goalValue > 0 ? clamp(previewAmount / goalValue, 0, 1) : 0;
    },
    [FILL_SWIPE_DISTANCE, PROGRESS_ACTIVATION_DISTANCE, PROGRESS_EASING, goalValue]
  );

  const flushDragFillToState = useCallback(() => {
    if (fillRafRef.current !== null) {
      cancelAnimationFrame(fillRafRef.current);
      fillRafRef.current = null;
    }
    setDragFillRatio(dragFillRatioRef.current);
  }, []);

  const setDragFillPreview = useCallback((next, { instant = false } = {}) => {
    if (fillResetTimeoutRef.current) {
      clearTimeout(fillResetTimeoutRef.current);
      fillResetTimeoutRef.current = null;
    }
    const clamped = clamp(next, 0, 1);
    const previous = dragFillRatioRef.current;
    if (!instant && Math.abs(clamped - previous) < 0.0015) return;
    dragFillRatioRef.current = clamped;

    if (instant) {
      flushDragFillToState();
      return;
    }

    if (fillRafRef.current !== null) return;
    fillRafRef.current = requestAnimationFrame(() => {
      fillRafRef.current = null;
      setDragFillRatio(dragFillRatioRef.current);
    });
  }, [flushDragFillToState]);

  const clearDragFillPreview = useCallback(({ deferMs = 0 } = {}) => {
    if (fillResetTimeoutRef.current) {
      clearTimeout(fillResetTimeoutRef.current);
      fillResetTimeoutRef.current = null;
    }

    const clearNow = () => {
      dragFillRatioRef.current = 0;
      flushDragFillToState();
    };

    if (deferMs > 0) {
      fillResetTimeoutRef.current = setTimeout(clearNow, deferMs);
      return;
    }

    clearNow();
  }, [flushDragFillToState]);

  const setSwipeInteractionActive = useCallback(
    (active) => {
      if (swipeActiveRef.current === active) return;
      swipeActiveRef.current = active;
      if (typeof onSwipeInteractionChange === 'function') {
        onSwipeInteractionChange(active);
      }
    },
    [onSwipeInteractionChange]
  );

  useEffect(
    () => () => {
      if (fillResetTimeoutRef.current) {
        clearTimeout(fillResetTimeoutRef.current);
        fillResetTimeoutRef.current = null;
      }
      if (fillRafRef.current !== null) {
        cancelAnimationFrame(fillRafRef.current);
        fillRafRef.current = null;
      }
      setSwipeInteractionActive(false);
    },
    [setSwipeInteractionActive]
  );

  useEffect(() => {
    if (swipeGesturesEnabled) return;
    setSwipeInteractionActive(false);
    clearDragFillPreview();
    translateX.stopAnimation(() => {
      translateX.setValue(0);
      setActionsOpen(false);
    });
  }, [clearDragFillPreview, setSwipeInteractionActive, swipeGesturesEnabled, translateX]);

  const closeActions = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 220,
      friction: 26,
      overshootClamping: true,
    }).start(() => setActionsOpen(false));
  }, [translateX]);

  const openActions = useCallback(() => {
    Animated.spring(translateX, {
      toValue: -ACTION_RAIL_WIDTH,
      useNativeDriver: true,
      tension: 220,
      friction: 26,
      overshootClamping: true,
    }).start(() => setActionsOpen(true));
  }, [ACTION_RAIL_WIDTH, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, g) => {
          if (!swipeGesturesEnabled) return false;
          if (!canSwipeProgress && !canSwipeActions) return false;
          const absDx = Math.abs(g.dx);
          const absDy = Math.abs(g.dy);
          if (absDx < SWIPE_CAPTURE_DISTANCE) return false;
          if (absDx <= absDy * HORIZONTAL_INTENT_RATIO) return false;
          if (actionsOpen && canSwipeActions) return true;
          if (g.dx >= 0) return canSwipeProgress;
          return canSwipeActions;
        },
        onMoveShouldSetPanResponderCapture: (_, g) => {
          if (!swipeGesturesEnabled) return false;
          if (!canSwipeProgress && !canSwipeActions) return false;
          const absDx = Math.abs(g.dx);
          const absDy = Math.abs(g.dy);
          if (absDx < SWIPE_CAPTURE_DISTANCE) return false;
          if (absDx <= absDy * HORIZONTAL_INTENT_RATIO) return false;
          if (actionsOpen && canSwipeActions) return true;
          if (g.dx >= 0) return canSwipeProgress;
          return canSwipeActions;
        },
        onPanResponderGrant: () => {
          if (!canSwipeProgress && !canSwipeActions) return;
          const startAmount = currentAmountRef.current;
          swipeStartAmountRef.current = startAmount;
          swipeModeRef.current = actionsOpen ? 'actions' : 'idle';
          setSwipeInteractionActive(true);
        },
        onPanResponderMove: (_, g) => {
          if (!canSwipeProgress && !canSwipeActions) return;

          if (actionsOpen) {
            swipeModeRef.current = 'actions';
            clearDragFillPreview();
            if (g.dx >= 0) {
              const dampedDx = g.dx * ACTION_DRAG_DAMPING;
              translateX.setValue(clamp(-ACTION_RAIL_WIDTH + dampedDx, -ACTION_RAIL_WIDTH, 0));
            } else {
              translateX.setValue(-ACTION_RAIL_WIDTH);
            }
            return;
          }

          if (swipeModeRef.current === 'idle') {
            if (g.dx >= 0 && canSwipeProgress) {
              swipeModeRef.current = 'progress';
            } else if (g.dx < 0 && canSwipeActions) {
              swipeModeRef.current = 'actions';
            } else {
              return;
            }
          }

          if (swipeModeRef.current === 'actions') {
            if (!canSwipeActions) return;
            clearDragFillPreview();
            const lockedDx = Math.min(0, g.dx);
            const dampedDx = lockedDx * ACTION_DRAG_DAMPING;
            translateX.setValue(clamp(dampedDx, -ACTION_RAIL_WIDTH, 0));
            return;
          }

          if (swipeModeRef.current !== 'progress' || !canSwipeProgress) return;
          const lockedDx = Math.max(0, g.dx);
          translateX.setValue(0);
          setDragFillPreview(getSwipePreviewRatio(lockedDx, swipeStartAmountRef.current));
        },
        onPanResponderRelease: (_, g) => {
          const swipeMode = swipeModeRef.current;
          swipeModeRef.current = 'idle';
          setSwipeInteractionActive(false);
          if (!canSwipeProgress && !canSwipeActions) {
            clearDragFillPreview();
            closeActions();
            return;
          }

          if (actionsOpen) {
            clearDragFillPreview();
            const shouldClose = g.dx > ACTION_CLOSE_DISTANCE || g.vx > ACTION_CLOSE_VELOCITY;
            if (shouldClose) {
              closeActions();
            } else {
              openActions();
            }
            return;
          }

          if (swipeMode === 'actions' || g.dx < 0) {
            if (!canSwipeActions) {
              clearDragFillPreview();
              closeActions();
              return;
            }
            clearDragFillPreview();
            const lockedDx = Math.min(0, g.dx);
            const shouldOpen = lockedDx < -ACTION_OPEN_DISTANCE || g.vx < ACTION_OPEN_VELOCITY;
            if (shouldOpen) {
              openActions();
            } else {
              closeActions();
            }
            return;
          }

          if (swipeMode === 'progress' && g.dx >= PROGRESS_COMMIT_DISTANCE && canSwipeProgress) {
            const nextAmount = getSwipeTargetAmount(g.dx, swipeStartAmountRef.current);
            const amountDelta = nextAmount - swipeStartAmountRef.current;
            if (amountDelta < swipeStepAmount) {
              clearDragFillPreview();
              closeActions();
              return;
            }
            if (nextAmount <= currentAmountRef.current) {
              clearDragFillPreview();
              closeActions();
              return;
            }
            const targetRatio = goalValue > 0 ? clamp(nextAmount / goalValue, 0, 1) : 0;
            setDragFillPreview(targetRatio, { instant: true });
            onSwipeAdd(habit, nextAmount);
            clearDragFillPreview({ deferMs: 120 });
            closeActions();
            return;
          }

          clearDragFillPreview();
          closeActions();
        },
        onPanResponderTerminate: () => {
          swipeModeRef.current = 'idle';
          setSwipeInteractionActive(false);
          clearDragFillPreview();
          if (actionsOpen) {
            openActions();
          } else {
            closeActions();
          }
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [
      ACTION_RAIL_WIDTH,
      ACTION_CLOSE_DISTANCE,
      ACTION_CLOSE_VELOCITY,
      ACTION_DRAG_DAMPING,
      ACTION_OPEN_DISTANCE,
      ACTION_OPEN_VELOCITY,
      HORIZONTAL_INTENT_RATIO,
      PROGRESS_COMMIT_DISTANCE,
      SWIPE_CAPTURE_DISTANCE,
      actionsOpen,
      canSwipeActions,
      canSwipeProgress,
      clearDragFillPreview,
      closeActions,
      dragFillRatioRef,
      goalValue,
      getSwipeTargetAmount,
      getSwipePreviewRatio,
      habit,
      onSwipeAdd,
      setSwipeInteractionActive,
      openActions,
      setDragFillPreview,
      swipeGesturesEnabled,
      swipeStepAmount,
      translateX,
    ]
  );
  const resolvedPanHandlers = swipeGesturesEnabled ? panResponder.panHandlers : {};

  const achievedReferenceDate = parseDateOnly(habit?.endDate) || new Date();
  const achievedFinalStreak = achieved
    ? computeCurrentStreakFromDateKeys(
        habit?.completedDates || [],
        habit?.goalPeriod || 'day',
        achievedReferenceDate
      )
    : 0;
  const overdoneVisual = overdone && !achieved;
  const isAndroid = Platform.OS === 'android';
  const currentAmount = Math.max(0, parseNumber(progress, 0));
  const livePreviewRatio = clamp(Math.max(ratio, dragFillRatio), 0, 1);
  const rawPreviewAmount = livePreviewRatio * goalValue;
  const snappedPreviewAmount = Math.round(rawPreviewAmount / swipeStepAmount) * swipeStepAmount;
  const displayProgressAmount = Math.max(
    currentAmount,
    Number(clamp(snappedPreviewAmount, 0, goalValue).toFixed(swipeStepPrecision))
  );
  const visualFillRatio = overdoneVisual ? 0 : completed ? 1 : livePreviewRatio;
  const formatAmount = (value) =>
    swipeStepPrecision === 0
      ? String(Math.round(value))
      : String(Number(parseNumber(value, 0).toFixed(swipeStepPrecision)));
  const goalValueLabel = formatAmount(goalValue);
  const displayProgressLabel = formatAmount(displayProgressAmount);
  const fillWidth = rowWidth * visualFillRatio;
  const habitColor = habit.color || palette.habits;
  const overdoneBorderColor = palette.isDark ? '#6B7280' : '#9CA3AF';
  const overdoneSurfaceColor = palette.isDark ? '#4B5563' : '#D1D5DB';
  const overdoneTrackColor = palette.isDark ? '#374151' : '#E5E7EB';
  const tintedTrack = overdoneVisual ? overdoneTrackColor : withAlpha(habitColor, 0.16);
  const surfaceTone = shadeColor(habitColor, completed ? -0.16 : -0.24);
  const tintedSurface = overdoneVisual
    ? overdoneSurfaceColor
    : withAlpha(surfaceTone, completed ? 0.58 : 0.52);
  const colorBackdrop = palette.background || palette.card || '#FFFFFF';
  const tintedTrackColor = isAndroid ? toOpaqueColor(tintedTrack, colorBackdrop) : tintedTrack;
  const tintedSurfaceColor = isAndroid
    ? toOpaqueColor(tintedSurface, colorBackdrop)
    : tintedSurface;
  const androidFillOverlayColor = isAndroid ? habitColor : null;
  const achievedPreferredText = getReadableTextColor(habitColor);
  const achievedFallbackText = achievedPreferredText === '#111827' ? '#F8FAFC' : '#111827';
  const achievedContrastText = resolveContrastColor({
    preferredColor: achievedPreferredText,
    backgroundColor: habitColor,
    fallbackColor: achievedFallbackText,
    backgroundBaseColor: palette.background || '#FFFFFF',
    minContrast: 4.5,
  });
  const shouldRenderFillTrack = !isAndroid && !overdoneVisual && !achieved && visualFillRatio > 0.001;
  const habitTextColor = overdoneVisual
    ? palette.isDark
      ? '#F9FAFB'
      : '#111827'
    : achieved
      ? achievedContrastText
      : '#F8FAFC';
  const habitSubTextColor = achieved ? habitTextColor : withAlpha(habitTextColor, 0.82);
  const habitHintColor = overdoneVisual
    ? '#DC2626'
    : achieved
      ? habitTextColor
      : withAlpha(habitTextColor, 0.72);
  const streakIsFrozenVisual =
    streakFrozen &&
    freezeEligible &&
    !overdoneVisual &&
    !achieved &&
    !completed &&
    (habit.streak || 0) > 0;
  const streakIconColor = overdoneVisual
    ? '#DC2626'
    : streakIsFrozenVisual
      ? '#4DA6FF'
    : achieved
      ? habitTextColor
    : resolveContrastColor({
        preferredColor: '#F97316',
        backgroundColor: tintedSurfaceColor,
        fallbackColor: habitTextColor === '#F8FAFC' ? '#F97316' : habitTextColor,
        backgroundBaseColor: tintedTrackColor,
      });
  const streakIconName = overdoneVisual ? 'close-circle' : achieved ? 'flag' : 'flame';
  const streakLabel = overdoneVisual
    ? 'Habit overdone'
    : achieved
      ? `Final streak: ${achievedFinalStreak} ${getStreakUnit(habit.goalPeriod, achievedFinalStreak !== 1)}`
      : formatStreakSummary(habit.streak || 0, habit.goalPeriod);
  const warningHintText = overdoneVisual
    ? 'Stick to your limit to complete this quit habit and keep your streak.'
    : achieved
      ? 'This habit has been achieved'
      : manualPlusEnabled
        ? 'Tap + to add progress - Swipe left for actions - Tap for exact amount'
        : 'Swipe right to add progress - Swipe left for actions - Tap for exact amount';
  const cardBorderColor = overdoneVisual
    ? overdoneBorderColor
    : achieved
      ? shadeColor(habitColor, -0.18)
      : habitColor;
  const cardSurfaceColor = achieved ? habitColor : tintedSurfaceColor;
  const avatarColor = overdoneVisual
    ? withAlpha('#FFFFFF', palette.isDark ? 0.16 : 0.42)
    : achieved
      ? withAlpha('#FFFFFF', palette.isDark ? 0.22 : 0.24)
    : withAlpha(habitColor, 0.2);

  return (
    <View style={styles.swipeRow}>
      <Animated.View
        style={[
          styles.swipeTrack,
          {
            width: rowWidth + ACTION_RAIL_WIDTH,
            transform: [{ translateX }],
          },
        ]}
        {...resolvedPanHandlers}
      >
        <Animated.View
          style={[
            styles.habitWrapper,
            { width: rowWidth, transform: [{ scale: streakPopScale }] },
          ]}
        >
          {shouldRenderFillTrack ? (
            <View pointerEvents="none" style={[styles.fillTrack, { backgroundColor: tintedTrackColor }]}>
              <View style={[styles.fillValue, { width: fillWidth, backgroundColor: habitColor }]} />
            </View>
          ) : null}
          <TouchableOpacity
            style={[
              styles.habitCard,
              {
                borderColor: cardBorderColor,
                backgroundColor: cardSurfaceColor,
              },
            ]}
            onPress={() => {
              if (actionsOpen) {
                closeActions();
                return;
              }
              onTap(habit);
            }}
            activeOpacity={0.9}
          >
            {isAndroid && !overdoneVisual && !achieved && visualFillRatio > 0.001 ? (
              <View
                pointerEvents="none"
                style={[
                  styles.androidFillOverlay,
                  {
                    ...(visualFillRatio >= 0.999
                      ? { right: 0 }
                      : { width: `${visualFillRatio * 100}%` }),
                    backgroundColor: androidFillOverlayColor,
                    borderTopRightRadius: visualFillRatio >= 0.999 ? borderRadius.xl : 0,
                    borderBottomRightRadius: visualFillRatio >= 0.999 ? borderRadius.xl : 0,
                  },
                ]}
              />
            ) : null}
            <View style={styles.habitCardContent}>
              <View style={styles.habitRow}>
                <View style={[styles.habitAvatar, { backgroundColor: avatarColor }]}>
                  <Text style={[styles.habitAvatarText, { color: habitTextColor }]}>
                    {habit.emoji || habit.title?.slice(0, 1)?.toUpperCase() || 'H'}
                  </Text>
                </View>
                <View style={styles.habitInfo}>
                  <Text style={[styles.habitTitle, { color: habitTextColor }]} numberOfLines={1}>{habit.title}</Text>
                  {!achieved ? (
                    <Text style={[styles.habitMeta, { color: habitSubTextColor }]}>
                      {displayProgressLabel} / {goalValueLabel} {habit.goalUnit || 'times'}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.progressMeta}>
                  <View style={styles.progressStreakRow}>
                    <Ionicons name={streakIconName} size={14} color={streakIconColor} />
                    <Text style={[styles.progressMetaStreak, { color: overdoneVisual ? '#DC2626' : habitTextColor }]}>
                      {streakLabel}
                    </Text>
                  </View>
                  {!achieved && manualPlusEnabled ? (
                    <TouchableOpacity
                      style={[
                        styles.quickAddButton,
                        {
                          backgroundColor: isInteractive ? '#16A34A' : withAlpha('#16A34A', 0.28),
                          borderColor: isInteractive ? '#16A34A' : withAlpha('#16A34A', 0.44),
                        },
                      ]}
                      onPress={() => {
                        if (!isInteractive) return;
                        onQuickAdd?.(habit);
                      }}
                      disabled={!isInteractive}
                      activeOpacity={0.88}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : null}
                  {!achieved && !manualPlusEnabled ? (
                    <Text style={[styles.progressMetaPercent, { color: habitTextColor }]}>
                      {Math.round(livePreviewRatio * 100)}%
                    </Text>
                  ) : null}
                </View>
              </View>
              {achieved ? (
                <View style={styles.habitHintRow}>
                  <Ionicons name="checkmark-circle" size={14} color={habitTextColor} />
                  <Text style={[styles.habitHint, { color: habitHintColor, marginTop: 0, marginLeft: spacing.xs }]}>
                    {warningHintText}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.habitHint, { color: habitHintColor }]}>
                  {warningHintText}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
        <View style={[styles.actionRailInline, { width: ACTION_RAIL_WIDTH }]}>
          <TouchableOpacity style={[styles.actionTile, styles.actionTileEdit]} onPress={() => { closeActions(); onEdit(habit); }}>
            <Feather name="edit-2" size={17} color="#2D6BFF" />
            <Text style={[styles.actionText, { color: '#2D6BFF' }]}>Details</Text>
          </TouchableOpacity>
          {achieved ? (
            <TouchableOpacity style={[styles.actionTile, styles.actionTileDelete]} onPress={() => { closeActions(); onDelete?.(habit); }}>
              <Ionicons name="trash-outline" size={17} color="#DC2626" />
              <Text style={[styles.actionText, { color: '#DC2626' }]}>Delete</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={[styles.actionTile, styles.actionTileSkip]} onPress={() => { closeActions(); onSkip(habit); }}>
                <Ionicons name="play-skip-forward" size={17} color="#FF8A1F" />
                <Text style={[styles.actionText, { color: '#FF8A1F' }]}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionTile, styles.actionTileReset]} onPress={() => { closeActions(); onReset(habit); }}>
                <Ionicons name="refresh" size={17} color="#16A34A" />
                <Text style={[styles.actionText, { color: '#16A34A' }]}>Reset</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

const HabitsScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { width: windowWidth } = useWindowDimensions();
  const {
    habits,
    addHabit,
    addGroupHabit,
    updateGroupHabit,
    deleteGroupHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion,
    toggleGroupHabitCompletion,
    getCurrentStreak,
    isHabitCompletedToday,
    groups,
    friends,
    groupHabits,
    groupHabitCompletions,
    sendGroupInvites,
    shareHabitWithFriends,
    authUser,
    profile,
    profileLoaded,
    themeName,
    themeColors,
    userSettings,
    updateUserSettings,
    ensureHabitsLoaded,
    setHabitProgress,
    streakFrozen,
    completeHabitsTutorial,
  } = useApp();

  const isDark = themeName === 'dark';
  const palette = useMemo(
    () => ({
      isDark,
      habits: themeColors?.habits || colors.habits,
      success: themeColors?.success || colors.success,
      card: isDark ? '#1F1A2D' : '#FFFFFF',
      cardBorder: isDark ? '#3C3551' : '#E8DDF7',
      fillTrack: isDark ? '#2D2540' : '#F3EDFA',
      text: themeColors?.text || colors.text,
      textMuted: themeColors?.textSecondary || colors.textSecondary,
      textLight: themeColors?.textLight || colors.textLight,
      background: isDark ? '#120F1B' : '#F6F2FB',
      mutedSurface: isDark ? '#1A1626' : '#F8F4FC',
      switchTrack: isDark ? '#483A63' : '#E5D8F5',
    }),
    [isDark, themeColors]
  );
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [isHabitsHydrating, setIsHabitsHydrating] = useState(true);
  const isHabitsInteractionLocked = isHabitsHydrating && (habits?.length || 0) === 0;
  const [isHabitSwipeActive, setIsHabitSwipeActive] = useState(false);

  useEffect(() => {
    let isActive = true;

    const hydrateHabits = async () => {
      if (!authUser?.id) {
        if (isActive) setIsHabitsHydrating(false);
        return;
      }

      setIsHabitsHydrating(true);
      try {
        await ensureHabitsLoaded();
      } finally {
        if (isActive) setIsHabitsHydrating(false);
      }
    };

    hydrateHabits();
    return () => {
      isActive = false;
    };
  }, [authUser?.id, ensureHabitsLoaded]);

  const hasCompletedHabitsTutorial = profile?.hasCompletedHabitsTutorial === true;
  const shouldShowHabitsTutorial = profile?.hasCompletedHabitsTutorial === false;
  const [showHabitsHowTo, setShowHabitsHowTo] = useState(false);

  useEffect(() => {
    if (!isFocused || !authUser?.id || !profileLoaded) {
      setShowHabitsHowTo(false);
      return;
    }
    setShowHabitsHowTo(shouldShowHabitsTutorial);
  }, [isFocused, authUser?.id, profileLoaded, shouldShowHabitsTutorial]);

  const [selectedDate, setSelectedDate] = useState(() => toStartOfDay(new Date()));
  const [showSelectedDatePicker, setShowSelectedDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all_day');
  const [localProgressMap, setLocalProgressMap] = useState({});

  const [activeHabitId, setActiveHabitId] = useState(null);
  const [activeGroupHabitId, setActiveGroupHabitId] = useState(null);
  const [activeGroupHabitGroupId, setActiveGroupHabitGroupId] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [manualAutoComplete, setManualAutoComplete] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditingHabit, setIsEditingHabit] = useState(false);
  const [showAddTypePicker, setShowAddTypePicker] = useState(false);
  const [renderAddTypePicker, setRenderAddTypePicker] = useState(false);
  const [addTypePickerAnchor, setAddTypePickerAnchor] = useState(null);
  const [showCompletionMethodSheet, setShowCompletionMethodSheet] = useState(false);
  const [formHideSharingSection, setFormHideSharingSection] = useState(false);
  const [formLockedGroupId, setFormLockedGroupId] = useState(null);
  const [formOnlyGroupSelection, setFormOnlyGroupSelection] = useState(false);
  const addTypeButtonRef = useRef(null);
  const addTypeMenuAnim = useRef(new Animated.Value(0)).current;
  const handledCreateRequestKeyRef = useRef(null);
  const handledGroupDetailRequestKeyRef = useRef(null);

  const [showGoalPeriodSheet, setShowGoalPeriodSheet] = useState(false);
  const [showTaskDaysSheet, setShowTaskDaysSheet] = useState(false);
  const [showGoalUnitSheet, setShowGoalUnitSheet] = useState(false);
  const [goalUnitCategory, setGoalUnitCategory] = useState('quantity');
  const [showCustomGoalUnitInput, setShowCustomGoalUnitInput] = useState(false);
  const [customGoalUnitInput, setCustomGoalUnitInput] = useState('');
  const [showEmojiSheet, setShowEmojiSheet] = useState(false);
  const [showGroupShareSheet, setShowGroupShareSheet] = useState(false);
  const [showFriendInviteSheet, setShowFriendInviteSheet] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [reminderPickerDate, setReminderPickerDate] = useState(new Date());
  const [editingReminderTimeIndex, setEditingReminderTimeIndex] = useState(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const [habitTitle, setHabitTitle] = useState('');
  const [habitDescription, setHabitDescription] = useState('');
  const [habitEmoji, setHabitEmoji] = useState('');
  const [habitCategory, setHabitCategory] = useState('Personal');
  const [habitGroupId, setHabitGroupId] = useState(null);
  const [invitedFriendIds, setInvitedFriendIds] = useState([]);
  const [habitType, setHabitType] = useState('build');
  const [showQuitHabitInfoModal, setShowQuitHabitInfoModal] = useState(false);
  const [habitColor, setHabitColor] = useState(colors.habits);
  const [goalPeriod, setGoalPeriod] = useState('day');
  const [goalValueInput, setGoalValueInput] = useState('1');
  const [quitGoalDaysInput, setQuitGoalDaysInput] = useState('');
  const [goalUnit, setGoalUnit] = useState('times');
  const [taskDaysMode, setTaskDaysMode] = useState('every_day');
  const [taskDaysCount, setTaskDaysCount] = useState(3);
  const [selectedDays, setSelectedDays] = useState(DAYS);
  const [selectedMonthDays, setSelectedMonthDays] = useState([new Date().getDate()]);
  const [timeRange, setTimeRange] = useState('all_day');
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTimes, setReminderTimes] = useState([]);
  const [reminderMessage, setReminderMessage] = useState('');
  const [showMemoAfterCompletion, setShowMemoAfterCompletion] = useState(false);
  const [chartType, setChartType] = useState('bar');
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [endDate, setEndDate] = useState(null);

  const [monthAnchor, setMonthAnchor] = useState(new Date());

  const selectedDateKey = toDateKey(selectedDate);
  const selectedDateISO = toISODate(selectedDate);
  const isSelectedDateToday = isSameDay(selectedDate, new Date());
  const manualAmountValue = Math.max(0, parseNumber(manualAmount, 0));
  const habitCompletionMethod = normalizeHabitCompletionMethod(
    userSettings?.habitCompletionMethod
  );
  const normalizedGoalUnit = sanitizeGoalUnit(goalUnit, 'times');
  const currentGoalUnitPresets = GOAL_UNIT_PRESETS[goalUnitCategory] || [];
  const isGoalUnitPreset = currentGoalUnitPresets.some(
    (unit) => unit.toLowerCase() === normalizedGoalUnit.toLowerCase()
  );
  const parsedStartDate = parseDateOnly(startDate) || new Date();
  const parsedQuitGoalDays = parsePositiveIntOrNull(quitGoalDaysInput);
  const projectedQuitEndDate = useMemo(() => {
    if (habitType !== 'quit' || !parsedQuitGoalDays) return null;
    return toISODate(addDays(parsedStartDate, parsedQuitGoalDays - 1));
  }, [habitType, parsedQuitGoalDays, parsedStartDate]);
  const parsedEndDate = parseDateOnly(endDate);

  const habitsWithDefaults = useMemo(() => (habits || []).map(withDefaults), [habits]);
  const sourceHabitsById = useMemo(
    () =>
      (habitsWithDefaults || []).reduce((acc, habit) => {
        if (habit?.id) acc[habit.id] = habit;
        return acc;
      }, {}),
    [habitsWithDefaults]
  );
  const selectedShareGroup = useMemo(
    () => (groups || []).find((group) => group.id === habitGroupId) || null,
    [groups, habitGroupId]
  );
  const availableFriends = useMemo(
    () => (friends || []).filter((friend) => friend?.id && friend.id !== authUser?.id),
    [friends, authUser?.id]
  );
  const showGroupSelectionRow = formOnlyGroupSelection || habitCategory === 'Group';
  const pendingCreateRequestKey = route?.params?.openHabitFormKey || null;
  const pendingCreateGroupId = route?.params?.groupId || null;
  const pendingCreateHideSharing = Boolean(route?.params?.hideSharing);
  const pendingCreateLockGroupSelection = Boolean(route?.params?.lockGroupSelection);
  const pendingGroupHabitDetailKey = route?.params?.openGroupHabitDetailKey || null;
  const pendingGroupHabitId = route?.params?.groupHabitId || null;
  const pendingGroupHabitGroupId = route?.params?.groupId || null;
  const mapGroupHabitForDetail = useCallback(
    (groupHabit) => {
      if (!groupHabit?.id) return null;
      const sourceHabit = groupHabit?.sourceHabitId ? sourceHabitsById[groupHabit.sourceHabitId] : null;
      const goalValue = Math.max(1, parseNumber(groupHabit.goalValue, parseNumber(sourceHabit?.goalValue, 1)));
      const isQuitHabit = (groupHabit.habitType || sourceHabit?.habitType || 'build') === 'quit';
      const myRows = (groupHabitCompletions[groupHabit.id] || []).filter(
        (row) => row?.userId === authUser?.id
      );
      const progressByDate = {};
      myRows.forEach((row) => {
        const parsed = new Date(row?.date);
        if (Number.isNaN(parsed.getTime())) return;
        const key = toDateKey(parsed);
        const rawAmount = Number(row?.amount);
        const amount = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 1;
        progressByDate[key] = amount;
      });
      const completedDates = Object.entries(progressByDate)
        .filter(([, amount]) =>
          isQuitHabit ? amount <= goalValue : amount >= goalValue
        )
        .map(([key]) => key);
      const groupName =
        (groups || []).find((group) => group?.id === groupHabit.groupId)?.name || null;
      const mergedHabit = {
        ...groupHabit,
        category: groupHabit.category || groupName || sourceHabit?.category || 'Group',
        description: groupHabit.description ?? sourceHabit?.description ?? '',
        repeat: groupHabit.repeat || sourceHabit?.repeat || 'Daily',
        days:
          Array.isArray(groupHabit.days) && groupHabit.days.length
            ? groupHabit.days
            : Array.isArray(sourceHabit?.days)
            ? sourceHabit.days
            : [],
        habitType: groupHabit.habitType || sourceHabit?.habitType || 'build',
        goalPeriod: groupHabit.goalPeriod || sourceHabit?.goalPeriod || 'day',
        goalValue,
        goalUnit: groupHabit.goalUnit || sourceHabit?.goalUnit || 'times',
        timeRange: groupHabit.timeRange || sourceHabit?.timeRange || 'all_day',
        remindersEnabled:
          groupHabit.remindersEnabled ?? sourceHabit?.remindersEnabled ?? false,
        reminderTimes:
          Array.isArray(groupHabit.reminderTimes) && groupHabit.reminderTimes.length
            ? groupHabit.reminderTimes
            : Array.isArray(sourceHabit?.reminderTimes)
            ? sourceHabit.reminderTimes
            : [],
        reminderMessage: groupHabit.reminderMessage || sourceHabit?.reminderMessage || '',
        taskDaysMode: groupHabit.taskDaysMode || sourceHabit?.taskDaysMode || 'every_day',
        taskDaysCount: parseNumber(
          groupHabit.taskDaysCount,
          parseNumber(sourceHabit?.taskDaysCount, 3)
        ),
        monthDays:
          Array.isArray(groupHabit.monthDays) && groupHabit.monthDays.length
            ? groupHabit.monthDays
            : Array.isArray(sourceHabit?.monthDays)
            ? sourceHabit.monthDays
            : [],
        showMemoAfterCompletion:
          groupHabit.showMemoAfterCompletion ?? sourceHabit?.showMemoAfterCompletion ?? false,
        chartType: groupHabit.chartType || sourceHabit?.chartType || 'bar',
        startDate: groupHabit.startDate || sourceHabit?.startDate || null,
        endDate: groupHabit.endDate || sourceHabit?.endDate || null,
        color: groupHabit.color || sourceHabit?.color || palette.habits,
        emoji: groupHabit.emoji || sourceHabit?.emoji || '',
      };
      return withDefaults({
        ...mergedHabit,
        progressByDate,
        completedDates,
        streak: computeCurrentStreakFromDateKeys(completedDates, mergedHabit.goalPeriod || 'day'),
        __isGroupHabit: true,
      });
    },
    [authUser?.id, groupHabitCompletions, groups, palette.habits, sourceHabitsById]
  );
  const groupHabitsWithDefaults = useMemo(
    () => (groupHabits || []).map(mapGroupHabitForDetail).filter(Boolean),
    [groupHabits, mapGroupHabitForDetail]
  );
  const visibleGroupHabits = useMemo(() => {
    const personalHabitIds = new Set((habitsWithDefaults || []).map((habit) => habit.id));
    return (groupHabitsWithDefaults || []).filter((habit) => {
      if (!habit?.sourceHabitId) return true;
      return !personalHabitIds.has(habit.sourceHabitId);
    });
  }, [groupHabitsWithDefaults, habitsWithDefaults]);
  const visibleHabits = useMemo(
    () => [...habitsWithDefaults, ...visibleGroupHabits],
    [habitsWithDefaults, visibleGroupHabits]
  );
  const selectedGroupHabit = useMemo(() => {
    if (!activeGroupHabitId) return null;
    const match = (groupHabits || []).find((habit) => {
      if (habit?.id !== activeGroupHabitId) return false;
      if (!activeGroupHabitGroupId) return true;
      return habit?.groupId === activeGroupHabitGroupId;
    });
    return mapGroupHabitForDetail(match);
  }, [
    activeGroupHabitId,
    activeGroupHabitGroupId,
    groupHabits,
    mapGroupHabitForDetail,
  ]);
  const selectedHabit = useMemo(
    () =>
      selectedGroupHabit ||
      habitsWithDefaults.find((habit) => habit.id === activeHabitId) ||
      null,
    [activeHabitId, habitsWithDefaults, selectedGroupHabit]
  );
  const selectedHabitColor = selectedHabit?.color || palette.habits;
  const detailCardColor = useMemo(
    () => shadeColor(selectedHabitColor, -0.4),
    [selectedHabitColor]
  );
  const selectedHabitAmount = selectedHabit
    ? getDateProgressAmount(selectedHabit, selectedDateKey, localProgressMap)
    : 0;
  const selectedHabitRatio = selectedHabit
    ? getCompletionRatio(selectedHabit, selectedHabitAmount, selectedDate)
    : 0;
  const selectedHabitPercent = Math.round(selectedHabitRatio * 100);
  const selectedHabitGoalValue = selectedHabit ? getGoalValue(selectedHabit) : 1;
  const selectedHabitIsQuit = (selectedHabit?.habitType || 'build') === 'quit';
  const selectedHabitIsOverdone = selectedHabitIsQuit && selectedHabitAmount > selectedHabitGoalValue;
  const selectedHabitLifecycleCompleted = selectedHabit
    ? hasHabitReachedEndDate(selectedHabit, new Date())
    : false;
  const selectedHabitCompletions = selectedHabit?.completedDates?.length || 0;
  const selectedHabitBestStreak = useMemo(
    () => computeBestStreakFromDateKeys(selectedHabit?.completedDates || [], selectedHabit?.goalPeriod || 'day'),
    [selectedHabit?.completedDates, selectedHabit?.goalPeriod]
  );
  const selectedHabitGoalsThisMonth = useMemo(() => {
    if (!selectedHabit) return 0;
    return (selectedHabit.completedDates || []).filter((key) => {
      const date = new Date(key);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === monthAnchor.getFullYear() &&
        date.getMonth() === monthAnchor.getMonth()
      );
    }).length;
  }, [monthAnchor, selectedHabit]);
  const selectedHabitCompletedForDate = selectedHabit
    ? isCompletedForDate(selectedHabit, selectedDateKey, selectedHabitAmount)
    : false;
  const selectedDatePrimaryLabel = isSameDay(selectedDate, new Date())
    ? 'Today'
    : selectedDate.toLocaleDateString(undefined, { weekday: 'short' });
  const selectedDateSecondaryLabel = selectedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const selectedHabitStartedOnLabel = selectedHabit
    ? formatDisplayDate(selectedHabit.startDate || selectedHabit.createdAt)
    : 'Not set';

  const baseFilteredHabits = useMemo(
    () =>
      visibleHabits
        .filter((habit) => {
          const fullyCompleted = hasHabitReachedEndDate(habit, new Date());
          const quitHabit = (habit?.habitType || 'build') === 'quit';
          if (selectedCategory === 'Achieved') return fullyCompleted;
          if (fullyCompleted) return false;
          if (selectedCategory === 'Personal') return !habit.__isGroupHabit;
          if (selectedCategory === 'Group') return Boolean(habit.__isGroupHabit);
          if (selectedCategory === 'Build habits') return !quitHabit;
          if (selectedCategory === 'Quit habits') return quitHabit;
          return true;
        })
        .filter((habit) => (selectedTimeRange === 'all_day' ? true : habit.timeRange === selectedTimeRange))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [visibleHabits, selectedCategory, selectedTimeRange]
  );
  const dueHabits = useMemo(
    () => {
      if (selectedCategory === 'Achieved') return baseFilteredHabits;
      return baseFilteredHabits.filter((habit) => isHabitScheduledForDate(habit, selectedDate));
    },
    [baseFilteredHabits, selectedCategory, selectedDate]
  );
  const filteredHabits = useMemo(
    () => {
      if (selectedCategory === 'Achieved') return baseFilteredHabits;
      return baseFilteredHabits.filter((habit) => {
        if (isHabitScheduledForDate(habit, selectedDate)) return true;
        const amount = getDateProgressAmount(habit, selectedDateKey, localProgressMap);
        if (amount > 0) return true;
        return (habit.completedDates || []).includes(selectedDateKey);
      });
    },
    [baseFilteredHabits, localProgressMap, selectedCategory, selectedDate, selectedDateKey]
  );

  const completedCount = useMemo(
    () => {
      if (selectedCategory === 'Achieved') return dueHabits.length;
      return dueHabits.filter((habit) => {
        const amount = getDateProgressAmount(habit, selectedDateKey, localProgressMap);
        return isCompletedForDate(habit, selectedDateKey, amount);
      }).length;
    },
    [dueHabits, selectedCategory, selectedDateKey, localProgressMap]
  );
  const selectedDateLabel = useMemo(() => {
    const date = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }, [selectedDate]);
  const shiftSelectedDate = useCallback((days) => {
    setSelectedDate((prev) => toStartOfDay(addDays(prev, days)));
  }, []);

  const statIconColors = useMemo(
    () => ({
      streak: streakFrozen ? '#4DA6FF' : palette.isDark ? '#FDBA74' : '#F97316',
      today: palette.isDark ? '#6EE7B7' : '#10B981',
      total: palette.isDark ? '#93C5FD' : '#2563EB',
    }),
    [palette.isDark, streakFrozen]
  );

  const resetForm = () => {
    setHabitTitle('');
    setHabitDescription('');
    setHabitEmoji('');
    setHabitCategory('Personal');
    setHabitGroupId(null);
    setInvitedFriendIds([]);
    setHabitType('build');
    setShowQuitHabitInfoModal(false);
    setHabitColor(palette.habits);
    setGoalPeriod('day');
    setGoalValueInput('1');
    setQuitGoalDaysInput('');
    setGoalUnit('times');
    setGoalUnitCategory('quantity');
    setShowCustomGoalUnitInput(false);
    setCustomGoalUnitInput('');
    setTaskDaysMode('every_day');
    setTaskDaysCount(3);
    setSelectedDays(DAYS);
    setSelectedMonthDays([new Date().getDate()]);
    setTimeRange('all_day');
    setRemindersEnabled(false);
    setReminderTimes([]);
    setReminderMessage('');
    setShowReminderTimePicker(false);
    setReminderPickerDate(new Date());
    setEditingReminderTimeIndex(null);
    setShowMemoAfterCompletion(false);
    setChartType('bar');
    setStartDate(toISODate(new Date()));
    setEndDate(null);
    setShowEmojiSheet(false);
    setShowGroupShareSheet(false);
    setShowFriendInviteSheet(false);
    setShowGoalPeriodSheet(false);
    setShowTaskDaysSheet(false);
    setShowGoalUnitSheet(false);
    setIsEditingHabit(false);
    setActiveGroupHabitId(null);
    setActiveGroupHabitGroupId(null);
    setFormHideSharingSection(false);
    setFormLockedGroupId(null);
    setFormOnlyGroupSelection(false);
  };

  const fillFormFromHabit = (habit) => {
    setHabitTitle(habit.title || '');
    setHabitDescription(habit.description || '');
    setHabitEmoji(habit.emoji || '');
    setHabitCategory(habit.category || 'Personal');
    setHabitGroupId(null);
    setInvitedFriendIds([]);
    setHabitType(habit.habitType || 'build');
    setShowQuitHabitInfoModal(false);
    setHabitColor(habit.color || palette.habits);
    setGoalPeriod(habit.goalPeriod || 'day');
    setGoalValueInput(String(getGoalValue(habit)));
    const quitGoalDays = (habit.habitType || 'build') === 'quit'
      ? getInclusiveDaySpan(
          habit.startDate || toISODate(new Date()),
          habit.endDate
        )
      : null;
    setQuitGoalDaysInput(quitGoalDays ? String(quitGoalDays) : '');
    const nextGoalUnit = sanitizeGoalUnit(habit.goalUnit, 'times');
    setGoalUnit(nextGoalUnit);
    setGoalUnitCategory(inferGoalUnitCategory(nextGoalUnit));
    setShowCustomGoalUnitInput(false);
    setCustomGoalUnitInput('');
    setTaskDaysMode(habit.taskDaysMode || 'every_day');
    setTaskDaysCount(parseNumber(habit.taskDaysCount, 3));
    setSelectedDays(Array.isArray(habit.days) ? habit.days.filter((d) => DAYS.includes(d)) : DAYS);
    setSelectedMonthDays(Array.isArray(habit.monthDays) && habit.monthDays.length ? habit.monthDays : [new Date().getDate()]);
    setTimeRange(habit.timeRange || 'all_day');
    setRemindersEnabled(Boolean(habit.remindersEnabled));
    setReminderTimes(Array.isArray(habit.reminderTimes) ? habit.reminderTimes : []);
    setReminderMessage(habit.reminderMessage || '');
    setShowReminderTimePicker(false);
    setReminderPickerDate(new Date());
    setEditingReminderTimeIndex(null);
    setShowMemoAfterCompletion(Boolean(habit.showMemoAfterCompletion));
    setChartType(habit.chartType || 'bar');
    setStartDate(habit.startDate || toISODate(new Date()));
    setEndDate(habit.endDate || null);
    setIsEditingHabit(true);
    setActiveGroupHabitId(null);
    setActiveGroupHabitGroupId(null);
    setActiveHabitId(habit.id);
    setFormHideSharingSection(false);
    setFormLockedGroupId(null);
    setFormOnlyGroupSelection(false);
  };

  const openCreateModalPersonal = () => {
    resetForm();
    setActiveHabitId(null);
    setFormHideSharingSection(false);
    setFormOnlyGroupSelection(false);
    setShowAddTypePicker(false);
    setRenderAddTypePicker(false);
    addTypeMenuAnim.stopAnimation();
    addTypeMenuAnim.setValue(0);
    setShowFormModal(true);
  };

  const openCreateModalGroup = () => {
    resetForm();
    setActiveHabitId(null);
    setHabitCategory('Group');
    setFormHideSharingSection(false);
    setFormOnlyGroupSelection(true);
    setShowAddTypePicker(false);
    setRenderAddTypePicker(false);
    addTypeMenuAnim.stopAnimation();
    addTypeMenuAnim.setValue(0);
    setShowFormModal(true);
  };

  const closeAddTypePicker = useCallback(() => {
    setShowAddTypePicker(false);
  }, []);

  const openAddTypePicker = useCallback(() => {
    setShowCompletionMethodSheet(false);
    const fallbackAnchor = {
      x: windowWidth - spacing.lg - 21,
      y: insets.top + spacing.sm + 21,
    };
    const node = addTypeButtonRef.current;

    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, width, height) => {
        const hasValidLayout =
          Number.isFinite(x) &&
          Number.isFinite(y) &&
          Number.isFinite(width) &&
          Number.isFinite(height);
        setAddTypePickerAnchor(
          hasValidLayout
            ? {
                x: x + width / 2,
                y: y + height / 2,
              }
            : fallbackAnchor
        );
        addTypeMenuAnim.setValue(0);
        setShowAddTypePicker(true);
      });
      return;
    }

    setAddTypePickerAnchor(fallbackAnchor);
    addTypeMenuAnim.setValue(0);
    setShowAddTypePicker(true);
  }, [addTypeMenuAnim, insets.top, windowWidth]);

  const toggleAddTypePicker = useCallback(() => {
    if (showAddTypePicker) {
      closeAddTypePicker();
      return;
    }
    openAddTypePicker();
  }, [closeAddTypePicker, openAddTypePicker, showAddTypePicker]);

  const openCompletionMethodSheet = useCallback(() => {
    closeAddTypePicker();
    setShowCompletionMethodSheet(true);
  }, [closeAddTypePicker]);

  const floatingAddButtonPosition = useMemo(() => {
    const fallbackX = windowWidth - spacing.lg - 21;
    const x = Number.isFinite(addTypePickerAnchor?.x) ? addTypePickerAnchor.x : fallbackX;
    const y = Number.isFinite(addTypePickerAnchor?.y) ? addTypePickerAnchor.y : insets.top + spacing.sm + 21;
    return {
      left: x - 21,
      top: y - 21,
    };
  }, [addTypePickerAnchor, insets.top, windowWidth]);

  const addTypeBackdropOpacity = addTypeMenuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const addTypeFloatingScale = addTypeMenuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });
  const addTypeFloatingOpacity = addTypeMenuAnim.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 0.35, 1],
  });
  const personalLabelTranslateX = addTypeMenuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [110, 0],
  });
  const groupLabelTranslateX = addTypeMenuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });
  const groupLabelTranslateY = addTypeMenuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 0],
  });
  const labelScale = addTypeMenuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.68, 1],
  });
  const labelOpacity = addTypeMenuAnim.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.4, 1],
  });

  useEffect(() => {
    if (showAddTypePicker) {
      setRenderAddTypePicker(true);
      addTypeMenuAnim.stopAnimation();
      Animated.spring(addTypeMenuAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 7,
      }).start();
      return;
    }

    addTypeMenuAnim.stopAnimation();
    Animated.timing(addTypeMenuAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRenderAddTypePicker(false);
    });
  }, [addTypeMenuAnim, showAddTypePicker]);

  useEffect(() => {
    if (!pendingCreateRequestKey) return;
    if (handledCreateRequestKeyRef.current === pendingCreateRequestKey) return;

    handledCreateRequestKeyRef.current = pendingCreateRequestKey;
    resetForm();
    setActiveHabitId(null);
    setShowAddTypePicker(false);

    if (pendingCreateGroupId) {
      const targetGroup = (groups || []).find((group) => group.id === pendingCreateGroupId);
      setHabitGroupId(pendingCreateGroupId);
      setHabitCategory(targetGroup?.name || 'Group');
      setFormLockedGroupId(pendingCreateLockGroupSelection ? pendingCreateGroupId : null);
    } else {
      setFormLockedGroupId(null);
    }

    setFormHideSharingSection(pendingCreateHideSharing);
    setFormOnlyGroupSelection(false);
    setShowFormModal(true);
  }, [
    pendingCreateRequestKey,
    pendingCreateGroupId,
    pendingCreateHideSharing,
    pendingCreateLockGroupSelection,
    groups,
  ]);

  useEffect(() => {
    if (!pendingGroupHabitDetailKey || !pendingGroupHabitId) return;
    if (handledGroupDetailRequestKeyRef.current === pendingGroupHabitDetailKey) return;

    const target = (groupHabits || []).find((habit) => {
      if (habit?.id !== pendingGroupHabitId) return false;
      if (!pendingGroupHabitGroupId) return true;
      return habit?.groupId === pendingGroupHabitGroupId;
    });
    if (!target) return;

    handledGroupDetailRequestKeyRef.current = pendingGroupHabitDetailKey;
    setActiveGroupHabitId(target.id);
    setActiveGroupHabitGroupId(target.groupId || pendingGroupHabitGroupId || null);
    setActiveHabitId(null);
    setShowAddTypePicker(false);
    setShowFormModal(false);
    setSelectedDate(toStartOfDay(new Date()));
    setShowDetailModal(true);
  }, [
    pendingGroupHabitDetailKey,
    pendingGroupHabitId,
    pendingGroupHabitGroupId,
    groupHabits,
  ]);

  const openEditFromDetail = () => {
    if (!selectedHabit) return;
    fillFormFromHabit(selectedHabit);
    if (selectedHabit.__isGroupHabit) {
      const targetGroupId = selectedHabit.groupId || pendingGroupHabitGroupId || null;
      setActiveHabitId(null);
      setActiveGroupHabitId(selectedHabit.id);
      setActiveGroupHabitGroupId(targetGroupId);
      setHabitGroupId(targetGroupId);
      setFormHideSharingSection(true);
      setFormOnlyGroupSelection(true);
      setFormLockedGroupId(targetGroupId);
    }
    setShowAddTypePicker(false);
    setShowDetailModal(false);
    setShowFormModal(true);
  };

  const applyProgress = async (habit, amountValue) => {
    if (isHabitsInteractionLocked) return;
    if (hasHabitReachedEndDate(habit, new Date())) return;
    const amount = Math.max(0, parseNumber(amountValue, 0));
    const localKey = `${habit.id}|${selectedDateKey}`;
    setLocalProgressMap((prev) => ({ ...prev, [localKey]: amount }));

    if (habit?.__isGroupHabit) {
      if (!isSelectedDateToday) return;
      const todayISO = toISODate(selectedDate);
      await toggleGroupHabitCompletion(habit.id, {
        amount,
        dateISO: todayISO,
      });
      return;
    }

    if (typeof setHabitProgress === 'function' && isSelectedDateToday) {
      await setHabitProgress(habit.id, amount, selectedDateISO);
      return;
    }

    const nowCompleted = isHabitCompletedToday(habit.id);
    const shouldBeCompleted =
      (habit.habitType || 'build') === 'quit'
        ? amount <= getGoalValue(habit)
        : amount >= getGoalValue(habit);
    if (isSelectedDateToday && nowCompleted !== shouldBeCompleted) {
      await toggleHabitCompletion(habit.id);
    }
  };

  const handleQuickAddProgress = useCallback(
    async (habit) => {
      if (!habit || !isSelectedDateToday || isHabitsInteractionLocked) return;
      if (hasHabitReachedEndDate(habit, new Date())) return;

      const currentAmount = Math.max(
        0,
        getDateProgressAmount(habit, selectedDateKey, localProgressMap)
      );
      const goalValue = getGoalValue(habit);
      const stepAmount = getHabitSwipeStepAmount(goalValue);
      const stepPrecision =
        stepAmount >= 1 ? 0 : Math.min(3, String(stepAmount).split('.')[1]?.length || 1);
      const habitType = habit?.habitType || 'build';
      const nextRawAmount = Number((currentAmount + stepAmount).toFixed(stepPrecision));
      const nextAmount =
        habitType === 'quit'
          ? nextRawAmount
          : Number(Math.min(goalValue, nextRawAmount).toFixed(stepPrecision));

      if (nextAmount <= currentAmount) return;
      await applyProgress(habit, nextAmount);
    },
    [applyProgress, isSelectedDateToday, isHabitsInteractionLocked, localProgressMap, selectedDateKey]
  );

  const submitManualAmount = async () => {
    if (!selectedHabit || !isSelectedDateToday) {
      setShowManualModal(false);
      setManualAutoComplete(false);
      return;
    }
    const amountToApply = manualAutoComplete ? getGoalValue(selectedHabit) : manualAmount;
    await applyProgress(selectedHabit, amountToApply);
    setShowManualModal(false);
    setManualAutoComplete(false);
  };

  const nudgeManualAmount = useCallback(
    (delta) => {
      const next = Math.max(0, manualAmountValue + delta);
      const normalized = Number.isInteger(next) ? next : Math.round(next * 1000) / 1000;
      setManualAutoComplete(false);
      setManualAmount(String(normalized));
    },
    [manualAmountValue]
  );

  const closeFormModal = () => {
    setShowFormModal(false);
    setShowEmojiSheet(false);
    setShowGroupShareSheet(false);
    setShowFriendInviteSheet(false);
    setShowGoalPeriodSheet(false);
    setShowTaskDaysSheet(false);
    setShowGoalUnitSheet(false);
    setShowCustomGoalUnitInput(false);
    setCustomGoalUnitInput('');
    setShowReminderTimePicker(false);
    setEditingReminderTimeIndex(null);
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
    setShowQuitHabitInfoModal(false);
  };

  const closeGoalUnitSheet = () => {
    setShowGoalUnitSheet(false);
    setShowCustomGoalUnitInput(false);
    setCustomGoalUnitInput('');
  };

  const openGoalUnitSheet = () => {
    setShowGoalPeriodSheet(false);
    setShowTaskDaysSheet(false);
    setGoalUnitCategory(inferGoalUnitCategory(goalUnit));
    setShowCustomGoalUnitInput(false);
    setCustomGoalUnitInput('');
    setShowGoalUnitSheet(true);
  };

  const selectGoalUnit = (unit) => {
    setGoalUnit(sanitizeGoalUnit(unit, 'times'));
    closeGoalUnitSheet();
  };

  const applyCustomGoalUnit = () => {
    const nextGoalUnit = sanitizeGoalUnit(customGoalUnitInput, '');
    if (!nextGoalUnit) {
      Alert.alert('Add a metric', 'Enter a custom metric name to use as your goal unit.');
      return;
    }
    setGoalUnit(nextGoalUnit);
    setGoalUnitCategory(inferGoalUnitCategory(nextGoalUnit));
    closeGoalUnitSheet();
  };

  const toggleGoalPeriodPicker = () => {
    setShowGoalPeriodSheet((prev) => !prev);
    setShowTaskDaysSheet(false);
    setShowGoalUnitSheet(false);
  };

  const toggleTaskDaysPicker = () => {
    setShowTaskDaysSheet((prev) => !prev);
    setShowGoalPeriodSheet(false);
    setShowGoalUnitSheet(false);
  };

  const openStartDatePicker = () => {
    setShowEndDatePicker(false);
    setShowStartDatePicker(true);
  };

  const openEndDatePicker = () => {
    setShowStartDatePicker(false);
    setShowEndDatePicker(true);
  };

  const handleStartDateChange = (dateValue) => {
    const nextStartDate = parseDateOnly(dateValue) || new Date();
    const nextStartISO = toISODate(nextStartDate);
    setStartDate(nextStartISO);

    const currentEndDate = parseDateOnly(endDate);
    if (
      currentEndDate &&
      toUtcDayNumber(nextStartDate) > toUtcDayNumber(currentEndDate)
    ) {
      setEndDate(nextStartISO);
    }
  };

  const handleEndDateChange = (dateValue) => {
    const nextEndDate = parseDateOnly(dateValue) || parsedStartDate;
    if (toUtcDayNumber(nextEndDate) < toUtcDayNumber(parsedStartDate)) {
      setEndDate(toISODate(parsedStartDate));
      return;
    }
    setEndDate(toISODate(nextEndDate));
  };

  const handleHabitTypeSelect = useCallback(
    (nextType) => {
      setHabitType(nextType);
      if (nextType === 'quit' && habitType !== 'quit') {
        if (!parsePositiveIntOrNull(quitGoalDaysInput)) {
          setQuitGoalDaysInput(DEFAULT_QUIT_GOAL_DAYS_PLACEHOLDER);
        }
        setShowQuitHabitInfoModal(true);
      }
    },
    [habitType, quitGoalDaysInput]
  );

  const toggleInvitedFriend = (friendId) => {
    setInvitedFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const applyReminderTime = (dateValue, targetIndex = null) => {
    const pickedDate = dateValue instanceof Date ? dateValue : new Date();
    const value = pickedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setReminderTimes((prev) => {
      if (targetIndex !== null && prev[targetIndex]) {
        const updated = [...prev];
        updated[targetIndex] = value;
        return Array.from(new Set(updated));
      }
      return Array.from(new Set([...prev, value]));
    });
    setEditingReminderTimeIndex(null);
    setShowReminderTimePicker(false);
  };

  const openReminderPicker = (index = null) => {
    const targetIndex = index;
    setEditingReminderTimeIndex(targetIndex);
    const seedDate =
      targetIndex !== null && reminderTimes[targetIndex] ? parseTimeStringToDate(reminderTimes[targetIndex]) : new Date();

    if (Platform.OS === 'android') {
      setShowReminderTimePicker(false);
      DateTimePickerAndroid.open({
        value: seedDate,
        mode: 'time',
        is24Hour: false,
        display: 'default',
        onChange: (event, selectedDate) => {
          if (event?.type === 'dismissed') {
            setEditingReminderTimeIndex(null);
            return;
          }
          applyReminderTime(selectedDate || seedDate, targetIndex);
        },
      });
      return;
    }

    setReminderPickerDate(seedDate);
    setShowReminderTimePicker(true);
  };

  const submitHabit = async () => {
    if (!habitTitle.trim()) return;
    const goalValue = Math.max(1, parseNumber(goalValueInput, 1));
    const normalizedStartDate = toISODate(parsedStartDate);
    let normalizedEndDate = endDate;

    if (habitType === 'quit' && parsedQuitGoalDays) {
      normalizedEndDate = toISODate(addDays(parsedStartDate, parsedQuitGoalDays - 1));
    }

    const parsedPayloadEndDate = parseDateOnly(normalizedEndDate);
    if (
      parsedPayloadEndDate &&
      toUtcDayNumber(parsedPayloadEndDate) < toUtcDayNumber(parsedStartDate)
    ) {
      normalizedEndDate = normalizedStartDate;
    }

    let repeat = 'Daily';
    if (goalPeriod === 'week') repeat = 'Weekly';
    if (goalPeriod === 'month') repeat = 'Monthly';

    let days = DAYS;
    if (taskDaysMode === 'specific_weekdays') days = selectedDays.length ? selectedDays : DAYS;
    if (taskDaysMode === 'specific_month_days') days = selectedMonthDays.map((day) => String(day));
    if (repeat === 'Monthly' && taskDaysMode !== 'specific_month_days') days = [String(selectedMonthDays[0] || 1)];

    const payload = {
      title: habitTitle.trim(),
      category: habitCategory,
      description: habitDescription.trim(),
      emoji: habitEmoji || null,
      repeat,
      days,
      habitType,
      color: habitColor,
      goalPeriod,
      goalValue,
      goalUnit: sanitizeGoalUnit(goalUnit, 'times'),
      taskDaysMode,
      taskDaysCount,
      monthDays: selectedMonthDays,
      timeRange,
      remindersEnabled,
      reminderTimes,
      reminderMessage: reminderMessage.trim(),
      showMemoAfterCompletion,
      chartType,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
    };

    const normalizedInviteIds = Array.from(new Set(invitedFriendIds)).filter(Boolean);
    const targetGroupId = formLockedGroupId || habitGroupId || null;

    if (formOnlyGroupSelection && !targetGroupId) {
      Alert.alert('Select a group', 'Choose a group to create this group habit.');
      return;
    }

    try {
      if (targetGroupId && normalizedInviteIds.length && typeof sendGroupInvites === 'function') {
        const memberIds = new Set(
          ((groups || []).find((group) => group.id === targetGroupId)?.members || [])
            .map((member) => member?.id)
            .filter(Boolean)
        );
        const idsToInvite = normalizedInviteIds.filter((id) => !memberIds.has(id));
        if (idsToInvite.length) {
          await sendGroupInvites({ groupId: targetGroupId, userIds: idsToInvite });
        }
      }

      if (isEditingHabit && selectedHabit) {
        if (selectedHabit.__isGroupHabit) {
          await updateGroupHabit(selectedHabit.id, payload);
        } else {
          await updateHabit(selectedHabit.id, payload);
          if (targetGroupId) {
            await addGroupHabit({ groupId: targetGroupId, sourceHabitId: selectedHabit.id, ...payload });
          } else if (normalizedInviteIds.length && typeof shareHabitWithFriends === 'function') {
            await shareHabitWithFriends(selectedHabit.id, normalizedInviteIds);
          }
        }
      } else if (targetGroupId) {
        if (formHideSharingSection) {
          await addGroupHabit({ groupId: targetGroupId, ...payload });
        } else {
          const createdHabit = await addHabit(payload);
          await addGroupHabit({ groupId: targetGroupId, sourceHabitId: createdHabit?.id || null, ...payload });
          if (
            normalizedInviteIds.length &&
            typeof shareHabitWithFriends === 'function' &&
            createdHabit?.id
          ) {
            await shareHabitWithFriends(createdHabit.id, normalizedInviteIds);
          }
        }
      } else {
        const createdHabit = await addHabit(payload);
        if (
          normalizedInviteIds.length &&
          typeof shareHabitWithFriends === 'function' &&
          createdHabit?.id
        ) {
          await shareHabitWithFriends(createdHabit.id, normalizedInviteIds);
        }
      }

      closeFormModal();
      resetForm();
    } catch (error) {
      Alert.alert('Unable to save habit', error?.message || 'Please try again.');
    }
  };

  const completeSelectedHabit = async () => {
    if (!selectedHabit) return;
    const todayISO = toISODate(new Date());
    try {
      if (selectedHabit.__isGroupHabit) {
        await updateGroupHabit(selectedHabit.id, { endDate: todayISO });
      } else {
        await updateHabit(selectedHabit.id, { endDate: todayISO });
      }
      setSelectedDate(toStartOfDay(new Date()));
    } catch (error) {
      Alert.alert('Unable to complete habit', error?.message || 'Please try again.');
    }
  };

  const removeHabitByItem = async (habitToRemove, { closeDetail = false } = {}) => {
    if (!habitToRemove) return;
    try {
      if (habitToRemove.__isGroupHabit) {
        await deleteGroupHabit(habitToRemove.id);
        if (closeDetail) setShowDetailModal(false);
        setActiveGroupHabitId((prev) => (prev === habitToRemove.id ? null : prev));
        setActiveGroupHabitGroupId((prev) =>
          prev === (habitToRemove.groupId || null) ? null : prev
        );
        return;
      }
      await deleteHabit(habitToRemove.id);
      if (closeDetail) setShowDetailModal(false);
      setActiveHabitId((prev) => (prev === habitToRemove.id ? null : prev));
    } catch (error) {
      Alert.alert(
        'Unable to delete habit',
        error?.message || 'Please try again. The habit was not removed from the database.'
      );
    }
  };

  const removeSelectedHabit = async () => {
    if (!selectedHabit) return;
    await removeHabitByItem(selectedHabit, { closeDetail: true });
  };

  const toggleWeekday = (day) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) return prev.filter((value) => value !== day);
      return [...prev, day];
    });
  };

  const toggleMonthDay = (day) => {
    setSelectedMonthDays((prev) => {
      if (prev.includes(day)) return prev.filter((value) => value !== day);
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const monthCells = useMemo(() => {
    const year = monthAnchor.getFullYear();
    const month = monthAnchor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i += 1) cells.push({ type: 'spacer', key: `s-${i}` });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      cells.push({ type: 'day', key: `d-${day}`, day, date, dateKey: toDateKey(date) });
    }
    return cells;
  }, [monthAnchor]);

  const applyHabitCompletionMethod = useCallback(
    async (methodValue) => {
      const nextMethod = normalizeHabitCompletionMethod(methodValue);
      if (nextMethod === habitCompletionMethod) return true;
      try {
        await updateUserSettings?.({ habitCompletionMethod: nextMethod });
        return true;
      } catch (error) {
        Alert.alert(
          'Unable to update method',
          error?.message || 'Please try again.'
        );
        return false;
      }
    },
    [habitCompletionMethod, updateUserSettings]
  );

  const handleFinishHabitsHowTo = useCallback(
    async ({ completionMethod } = {}) => {
      setShowHabitsHowTo(false);
      await applyHabitCompletionMethod(completionMethod || habitCompletionMethod);
      if (hasCompletedHabitsTutorial) return;
      completeHabitsTutorial?.();
    },
    [
      applyHabitCompletionMethod,
      completeHabitsTutorial,
      habitCompletionMethod,
      hasCompletedHabitsTutorial,
    ]
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.background, paddingTop: insets.top + spacing.sm }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isHabitSwipeActive}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.pageTitle, { color: palette.text }]}>Habits</Text>
            <Text style={[styles.pageSubtitle, { color: palette.textMuted }]}>Build better, quit worse</Text>
          </View>
          <View style={styles.headerAddWrap}>
            <TouchableOpacity
              style={[styles.headerSettingsButton, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}
              onPress={openCompletionMethodSheet}
              activeOpacity={0.9}
            >
              <Ionicons name="settings-outline" size={19} color={palette.text} />
            </TouchableOpacity>
            <TouchableOpacity
              ref={addTypeButtonRef}
              style={[styles.headerAddButton, { backgroundColor: palette.habits }]}
              onPress={toggleAddTypePicker}
              activeOpacity={0.9}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.dateRow}>
          <TouchableOpacity
            style={[styles.dateArrow, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}
            onPress={() => shiftSelectedDate(-1)}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-back" size={20} color={palette.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.datePicker, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}
            activeOpacity={0.85}
            onPress={() => setShowSelectedDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={18} color={palette.textMuted} />
            <Text style={[styles.dateText, { color: palette.text }]}>{selectedDateLabel}</Text>
            <Ionicons name="chevron-down" size={18} color={palette.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateArrow, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}
            onPress={() => shiftSelectedDate(1)}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-forward" size={20} color={palette.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <Card style={[styles.statCard, styles.statStreak]}>
            <Ionicons name="flame" size={16} color={statIconColors.streak} />
            <Text style={styles.statLabel}>Current streak</Text>
            <Text style={styles.statValue}>{getCurrentStreak()}</Text>
          </Card>
          <Card style={[styles.statCard, styles.statToday]}>
            <Feather name="target" size={16} color={statIconColors.today} />
            <Text style={styles.statLabel}>{isSelectedDateToday ? 'Due today' : 'Due this day'}</Text>
            <Text style={styles.statValue}>{completedCount}/{dueHabits.length}</Text>
          </Card>
          <Card style={[styles.statCard, styles.statTotal]}>
            <Ionicons name="stats-chart" size={16} color={statIconColors.total} />
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{visibleHabits.length}</Text>
          </Card>
        </View>

        <View style={styles.filterRow}>
          {HABIT_VIEW_FILTERS.map((category) => {
            const selected = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selected ? palette.habits : palette.card,
                    borderColor: selected ? palette.habits : palette.cardBorder,
                  },
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[styles.filterChipText, { color: selected ? '#FFFFFF' : palette.textMuted }]}>{category}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.filterRow}>
          {TIME_RANGE_OPTIONS.map((option) => {
            const selected = selectedTimeRange === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selected ? palette.habits : palette.card,
                    borderColor: selected ? palette.habits : palette.cardBorder,
                  },
                ]}
                onPress={() => setSelectedTimeRange(option.value)}
              >
                <Text style={[styles.filterChipText, { color: selected ? '#FFFFFF' : palette.textMuted }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!isSelectedDateToday && selectedCategory !== 'Achieved' ? (
          <View style={[styles.notice, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
            <Ionicons name="information-circle-outline" size={15} color={palette.textMuted} />
            <Text style={[styles.noticeText, { color: palette.textMuted }]}>
              Progress edits and swipe actions are available for today only.
            </Text>
          </View>
        ) : null}

        {filteredHabits.length === 0 ? (
          <View style={[styles.emptyState, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
            <Feather name="target" size={34} color={palette.habits} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              {selectedCategory === 'Achieved'
                ? 'No achieved habits yet'
                : selectedCategory === 'Build habits'
                ? 'No build habits yet'
                : selectedCategory === 'Quit habits'
                ? 'No quit habits yet'
                : 'No habits found'}
            </Text>
            <TouchableOpacity style={[styles.emptyButton, { backgroundColor: palette.habits }]} onPress={openCreateModalPersonal}>
              <Text style={styles.emptyButtonText}>Create Habit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredHabits.map((habit) => {
            const amount = getDateProgressAmount(habit, selectedDateKey, localProgressMap);
            const ratio = getCompletionRatio(habit, amount, selectedDate);
            const completed = isCompletedForDate(habit, selectedDateKey, amount);
            const overdone =
              (habit.habitType || 'build') === 'quit' && amount > getGoalValue(habit);
            const lifecycleCompleted = hasHabitReachedEndDate(habit, new Date());
            return (
              <SwipeHabitCard
                key={`${habit.__isGroupHabit ? 'group' : 'personal'}-${habit.id}`}
                habit={habit}
                progress={amount}
                ratio={ratio}
                completed={completed}
                achieved={lifecycleCompleted}
                overdone={overdone}
                streakFrozen={streakFrozen}
                freezeEligible={isSelectedDateToday}
                isInteractive={!isHabitsInteractionLocked && isSelectedDateToday && !lifecycleCompleted}
                onTap={(item) => {
                  if (isHabitsInteractionLocked && !lifecycleCompleted) return;
                  if (item.__isGroupHabit) {
                    setActiveHabitId(null);
                    setActiveGroupHabitId(item.id);
                    setActiveGroupHabitGroupId(item.groupId || null);
                  } else {
                    setActiveGroupHabitId(null);
                    setActiveGroupHabitGroupId(null);
                    setActiveHabitId(item.id);
                  }
                  if (lifecycleCompleted) {
                    setShowDetailModal(true);
                    return;
                  }
                  setManualAmount(String(Math.round(getDateProgressAmount(item, selectedDateKey, localProgressMap))));
                  setManualAutoComplete(false);
                  setShowManualModal(true);
                }}
                onEdit={(item) => {
                  if (item.__isGroupHabit) {
                    setActiveHabitId(null);
                    setActiveGroupHabitId(item.id);
                    setActiveGroupHabitGroupId(item.groupId || null);
                  } else {
                    setActiveGroupHabitId(null);
                    setActiveGroupHabitGroupId(null);
                    setActiveHabitId(item.id);
                  }
                  setShowDetailModal(true);
                }}
                onSkip={async (item) => {
                  await applyProgress(item, 0);
                }}
                onReset={async (item) => {
                  await applyProgress(item, 0);
                }}
                onDelete={async (item) => {
                  await removeHabitByItem(item);
                }}
                onSwipeAdd={applyProgress}
                onQuickAdd={handleQuickAddProgress}
                completionMethod={habitCompletionMethod}
                onSwipeInteractionChange={setIsHabitSwipeActive}
                styles={styles}
                palette={palette}
              />
            );
          })
        )}
      </PlatformScrollView>

      <HabitsHowToOverlay
        visible={showHabitsHowTo}
        onFinish={handleFinishHabitsHowTo}
        initialCompletionMethod={habitCompletionMethod}
      />

      {renderAddTypePicker ? (
        <RNModal
          visible
          transparent
          animationType="none"
          onRequestClose={closeAddTypePicker}
          statusBarTranslucent={Platform.OS === 'android'}
          hardwareAccelerated={Platform.OS === 'android'}
        >
          <Animated.View style={[styles.addTypeDimOverlay, { opacity: addTypeBackdropOpacity }]}>
            <TouchableOpacity
              style={styles.addTypeDimOverlayTouch}
              activeOpacity={1}
              onPress={closeAddTypePicker}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.addTypeFloatingWrap,
              floatingAddButtonPosition,
              {
                opacity: addTypeFloatingOpacity,
                transform: [{ scale: addTypeFloatingScale }],
              },
            ]}
          >
            <View style={styles.addTypeInlineMenu}>
              <Animated.View
                style={{
                  opacity: labelOpacity,
                  transform: [{ translateX: personalLabelTranslateX }, { scale: labelScale }],
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.addTypeInlinePill,
                    styles.addTypeInlinePillPersonal,
                    { borderColor: palette.cardBorder, backgroundColor: palette.card },
                  ]}
                  onPress={openCreateModalPersonal}
                  activeOpacity={0.92}
                >
                  <Text style={[styles.addTypeInlinePillText, { color: palette.text }]}>Personal</Text>
                </TouchableOpacity>
              </Animated.View>
              <Animated.View
                style={{
                  opacity: labelOpacity,
                  transform: [
                    { translateX: groupLabelTranslateX },
                    { translateY: groupLabelTranslateY },
                    { scale: labelScale },
                  ],
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.addTypeInlinePill,
                    styles.addTypeInlinePillGroup,
                    { borderColor: palette.cardBorder, backgroundColor: palette.card },
                  ]}
                  onPress={openCreateModalGroup}
                  activeOpacity={0.92}
                >
                  <Text style={[styles.addTypeInlinePillText, { color: palette.text }]}>Group</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
            <TouchableOpacity
              style={[styles.headerAddButton, { backgroundColor: palette.habits }]}
              onPress={closeAddTypePicker}
              activeOpacity={0.9}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        </RNModal>
      ) : null}

      <RNModal
        visible={showCompletionMethodSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCompletionMethodSheet(false)}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowCompletionMethodSheet(false)}
          />
          <View
            style={[
              styles.sheetCard,
              {
                backgroundColor: palette.card,
                borderColor: palette.cardBorder,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: palette.text }]}>Habit Completion Method</Text>
            {HABIT_COMPLETION_METHODS.map((option) => {
              const selected = habitCompletionMethod === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.completionMethodOption,
                    {
                      borderColor: selected ? palette.habits : palette.cardBorder,
                      backgroundColor: selected ? withAlpha(palette.habits, 0.14) : palette.mutedSurface,
                    },
                  ]}
                  onPress={async () => {
                    const updated = await applyHabitCompletionMethod(option.value);
                    if (updated) setShowCompletionMethodSheet(false);
                  }}
                  activeOpacity={0.9}
                >
                  <View
                    style={[
                      styles.completionMethodIcon,
                      { backgroundColor: selected ? palette.habits : palette.card },
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={selected ? '#FFFFFF' : palette.textMuted}
                    />
                  </View>
                  <View style={styles.completionMethodTextWrap}>
                    <Text style={[styles.completionMethodTitle, { color: palette.text }]}>{option.label}</Text>
                    <Text style={[styles.completionMethodDesc, { color: palette.textMuted }]}>
                      {option.description}
                    </Text>
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={20} color={palette.habits} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </RNModal>

      <Modal
        visible={showManualModal}
        onClose={() => {
          setShowManualModal(false);
          setManualAutoComplete(false);
        }}
        hideHeader
      >
        {selectedHabit ? (
          <View style={[styles.manualCard, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
            <Text style={[styles.manualTitle, { color: palette.text }]}>{selectedHabit.title}</Text>
            <Text style={[styles.manualSub, { color: palette.textMuted }]}>Add progress manually</Text>
            <TextInput
              style={[styles.manualInput, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.mutedSurface }]}
              value={manualAmount}
              onChangeText={setManualAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={palette.textLight}
            />
            <View style={styles.manualStepRow}>
              <TouchableOpacity
                style={[
                  styles.manualStepBtn,
                  {
                    backgroundColor: palette.mutedSurface,
                    borderColor: manualAmountValue <= 0 ? palette.cardBorder : palette.habits,
                    opacity: manualAmountValue <= 0 ? 0.55 : 1,
                  },
                ]}
                onPress={() => nudgeManualAmount(-1)}
                disabled={manualAmountValue <= 0}
              >
                <Ionicons name="remove" size={18} color={palette.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.manualStepBtn,
                  {
                    backgroundColor: palette.mutedSurface,
                    borderColor: palette.habits,
                  },
                ]}
                onPress={() => nudgeManualAmount(1)}
              >
                <Ionicons name="add" size={18} color={palette.habits} />
              </TouchableOpacity>
            </View>
            <View style={styles.manualCompleteWrap}>
              <TouchableOpacity
                style={[
                  styles.manualCompleteButton,
                  {
                    backgroundColor: manualAutoComplete ? '#16A34A' : palette.mutedSurface,
                    borderColor: manualAutoComplete ? '#16A34A' : palette.cardBorder,
                  },
                ]}
                onPress={() => {
                  const next = !manualAutoComplete;
                  setManualAutoComplete(next);
                  if (next) {
                    setManualAmount(String(getGoalValue(selectedHabit)));
                  }
                }}
                activeOpacity={0.9}
              >
                <Ionicons
                  name={manualAutoComplete ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={manualAutoComplete ? '#FFFFFF' : palette.textMuted}
                />
                <Text
                  style={[
                    styles.manualCompleteText,
                    { color: manualAutoComplete ? '#FFFFFF' : palette.text },
                  ]}
                >
                  {manualAutoComplete ? 'This will mark the habit complete' : 'Mark habit complete'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.manualCompleteHint, { color: palette.textMuted }]}>
                Sets amount to your goal automatically.
              </Text>
            </View>
            <Text style={[styles.manualGoal, { color: palette.textMuted }]}>
              Goal: {getGoalValue(selectedHabit)} {selectedHabit.goalUnit || 'times'}
            </Text>
            <View style={styles.manualButtons}>
              <TouchableOpacity
                style={[styles.manualBtn, { backgroundColor: palette.mutedSurface }]}
                onPress={() => {
                  setShowManualModal(false);
                  setManualAutoComplete(false);
                }}
              >
                <Text style={[styles.manualBtnText, { color: palette.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.manualBtn, { backgroundColor: selectedHabitColor }]}
                onPress={submitManualAmount}
              >
                <Text style={styles.manualBtnTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </Modal>

      <Modal
        visible={showFormModal}
        onClose={() => {
          if (showQuitHabitInfoModal) return;
          closeFormModal();
        }}
        hideHeader
        fullScreen
        swipeToCloseEnabled={!showQuitHabitInfoModal}
        scrollEnabled={!showQuitHabitInfoModal}
        contentStyle={{ paddingHorizontal: 0 }}
      >
        <View style={[styles.formScreen, { backgroundColor: palette.background, paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.formTop}>
            <TouchableOpacity style={[styles.iconButton, { borderColor: palette.cardBorder, backgroundColor: palette.card }]} onPress={closeFormModal}>
              <Ionicons name="chevron-back" size={20} color={palette.text} />
            </TouchableOpacity>
            <Text style={[styles.formTitle, { color: palette.text }]}>{isEditingHabit ? 'Edit Habit' : 'New Habit'}</Text>
            <View style={styles.formSpacer} />
          </View>

          <View style={styles.formBody}>
            <View style={[styles.sectionCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
              <View style={styles.formIdentityRow}>
                <View style={styles.formIdentityInputs}>
                  <TextInput style={[styles.formInput, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.mutedSurface }]} placeholder="Habit title" placeholderTextColor={palette.textLight} value={habitTitle} onChangeText={setHabitTitle} />
                  <TextInput style={[styles.formInput, styles.formTextArea, styles.formDescriptionInput, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.mutedSurface }]} placeholder="Description (optional)" placeholderTextColor={palette.textLight} value={habitDescription} onChangeText={setHabitDescription} multiline />
                </View>
                <TouchableOpacity
                  style={[styles.formEmojiButton, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}
                  onPress={() => setShowEmojiSheet((prev) => !prev)}
                >
                  <Text style={styles.formEmojiValue}>{habitEmoji || '\u{1F642}'}</Text>
                  <Text style={[styles.formEmojiLabel, { color: palette.textMuted }]}>Icon</Text>
                </TouchableOpacity>
              </View>
              {showEmojiSheet ? (
                <View style={[styles.emojiSelectorInline, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
                  <View style={styles.emojiGrid}>
                    {HABIT_EMOJI_OPTIONS.map((emoji) => {
                      const selected = habitEmoji === emoji;
                      return (
                        <TouchableOpacity
                          key={emoji}
                          style={[
                            styles.emojiOption,
                            {
                              borderColor: selected ? palette.habits : palette.cardBorder,
                              backgroundColor: selected ? withAlpha(palette.habits, 0.12) : palette.card,
                            },
                          ]}
                          onPress={() => {
                            setHabitEmoji(emoji);
                            setShowEmojiSheet(false);
                          }}
                        >
                          <Text style={styles.emojiOptionText}>{emoji}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity
                    style={[styles.sheetOption, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}
                    onPress={() => {
                      setHabitEmoji('');
                      setShowEmojiSheet(false);
                    }}
                  >
                    <Text style={[styles.sheetOptionText, { color: palette.textMuted, textAlign: 'center' }]}>No icon</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <ChipGroup options={habitCategories} selectedValue={habitCategory} onSelect={setHabitCategory} color={palette.habits} />
              <Text style={[styles.sectionTitle, { color: palette.text, marginTop: spacing.xs }]}>Habit color</Text>
              <View style={styles.colorRow}>
                {HABIT_COLOR_OPTIONS.map((option) => {
                  const selected = habitColor === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.colorSwatch,
                        {
                          backgroundColor: option,
                          borderColor: selected ? '#FFFFFF' : 'transparent',
                        },
                      ]}
                      onPress={() => setHabitColor(option)}
                    >
                      {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {!formHideSharingSection ? (
              <View style={[styles.sectionCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Sharing</Text>
                {showGroupSelectionRow ? (
                  <>
                    <TouchableOpacity
                      style={styles.rowLine}
                      onPress={() => {
                        setShowGroupShareSheet((prev) => !prev);
                        setShowFriendInviteSheet(false);
                      }}
                    >
                      <Text style={[styles.rowLabel, { color: palette.text }]}>Group selection</Text>
                      <Text style={[styles.rowValue, { color: palette.textMuted }]} numberOfLines={1}>
                        {selectedShareGroup?.name || 'None'}
                      </Text>
                    </TouchableOpacity>
                    {showGroupShareSheet ? (
                      <View style={[styles.inlineSheet, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
                        {!formOnlyGroupSelection ? (
                          <TouchableOpacity
                            style={[styles.sheetOption, styles.inlineSheetOption, { borderColor: !habitGroupId ? palette.habits : palette.cardBorder, backgroundColor: palette.card }]}
                            onPress={() => {
                              setHabitGroupId(null);
                              setShowGroupShareSheet(false);
                            }}
                          >
                            <Text style={[styles.sheetOptionText, { color: palette.text }]}>None</Text>
                          </TouchableOpacity>
                        ) : null}
                        {(groups || []).map((group) => (
                          <TouchableOpacity
                            key={group.id}
                            style={[styles.sheetOption, styles.inlineSheetOption, { borderColor: habitGroupId === group.id ? palette.habits : palette.cardBorder, backgroundColor: palette.card }]}
                            onPress={() => {
                              setHabitGroupId(group.id);
                              setShowGroupShareSheet(false);
                            }}
                          >
                            <Text style={[styles.sheetOptionText, { color: palette.text }]} numberOfLines={1}>{group.name || 'Group'}</Text>
                          </TouchableOpacity>
                        ))}
                        {!groups?.length ? (
                          <Text style={[styles.shareHint, { color: palette.textMuted }]}>No groups yet. Create one in the Groups area.</Text>
                        ) : null}
                        {formOnlyGroupSelection ? (
                          <Text style={[styles.shareHint, { color: palette.textMuted }]}>You must choose a group to create this habit.</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : null}

                {!formOnlyGroupSelection ? (
                  <>
                    <TouchableOpacity
                      style={styles.rowLine}
                      onPress={() => {
                        setShowFriendInviteSheet((prev) => !prev);
                        setShowGroupShareSheet(false);
                      }}
                    >
                      <Text style={[styles.rowLabel, { color: palette.text }]}>Invite friends</Text>
                      <Text style={[styles.rowValue, { color: palette.textMuted }]}>{invitedFriendIds.length ? `${invitedFriendIds.length} selected` : 'None'}</Text>
                    </TouchableOpacity>
                    {showFriendInviteSheet ? (
                      <View style={[styles.inlineSheet, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
                        {!availableFriends.length ? (
                          <Text style={[styles.shareHint, { color: palette.textMuted }]}>No friends to invite yet.</Text>
                        ) : (
                          (availableFriends || []).map((friend) => {
                            const selected = invitedFriendIds.includes(friend.id);
                            return (
                              <View key={friend.id} style={styles.shareFriendRow}>
                                <View style={styles.shareFriendTextWrap}>
                                  <Text style={[styles.shareFriendName, { color: palette.text }]} numberOfLines={1}>
                                    {friend.name || friend.username || 'Friend'}
                                  </Text>
                                  <Text style={[styles.shareFriendUser, { color: palette.textMuted }]} numberOfLines={1}>
                                    {friend.username ? `@${friend.username}` : ''}
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  style={[styles.shareFriendAction, { borderColor: selected ? palette.habits : palette.cardBorder, backgroundColor: selected ? withAlpha(palette.habits, 0.12) : palette.card }]}
                                  onPress={() => toggleInvitedFriend(friend.id)}
                                >
                                  <Text style={[styles.shareFriendActionText, { color: selected ? palette.habits : palette.textMuted }]}>{selected ? 'Invited' : 'Invite'}</Text>
                                </TouchableOpacity>
                              </View>
                            );
                          })
                        )}
                        <Text style={[styles.shareHint, { color: palette.textMuted }]}>
                          If no group is selected, invited friends will get direct access to this habit.
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.sectionCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Habit type</Text>
              <View style={[styles.segmentWrap, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
                <TouchableOpacity style={[styles.segment, habitType === 'build' && { backgroundColor: palette.habits }]} onPress={() => handleHabitTypeSelect('build')}>
                  <Text style={[styles.segmentText, { color: habitType === 'build' ? '#FFFFFF' : palette.textMuted }]}>Build</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.segment, habitType === 'quit' && { backgroundColor: '#C7712A' }]} onPress={() => handleHabitTypeSelect('quit')}>
                  <Text style={[styles.segmentText, { color: habitType === 'quit' ? '#FFFFFF' : palette.textMuted }]}>Quit</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.rowLine} onPress={toggleGoalPeriodPicker}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>Streak repeat</Text>
                <Text style={[styles.rowValue, { color: palette.textMuted }]}>
                  {GOAL_PERIOD_OPTIONS.find((item) => item.value === goalPeriod)?.label || 'Daily'}
                </Text>
              </TouchableOpacity>
              {showGoalPeriodSheet ? (
                <View style={[styles.inlineSheet, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
                  {GOAL_PERIOD_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.sheetOption, styles.inlineSheetOption, { borderColor: goalPeriod === option.value ? palette.habits : palette.cardBorder, backgroundColor: palette.card }]}
                      onPress={() => {
                        setGoalPeriod(option.value);
                        setShowGoalPeriodSheet(false);
                      }}
                    >
                      <Text style={[styles.sheetOptionText, { color: palette.text }]}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <View style={styles.rowLine}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>Goal value</Text>
                <View style={styles.goalInputs}>
                  <TextInput style={[styles.goalInput, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.mutedSurface }]} value={goalValueInput} onChangeText={setGoalValueInput} keyboardType="numeric" />
                  <TouchableOpacity
                    style={[
                      styles.goalUnitButton,
                      {
                        borderColor: palette.cardBorder,
                        backgroundColor: palette.mutedSurface,
                      },
                    ]}
                    onPress={openGoalUnitSheet}
                    activeOpacity={0.88}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.goalUnitButtonText, { color: palette.text }]} numberOfLines={1}>
                      {normalizedGoalUnit}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={palette.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
              {habitType === 'quit' ? (
                <>
                  <View style={styles.rowLine}>
                    <Text style={[styles.rowLabel, { color: palette.text }]}>Goal (days quit)</Text>
                    <TextInput
                      style={[
                        styles.goalInput,
                        styles.goalDaysInput,
                        {
                          borderColor: palette.cardBorder,
                          color: palette.text,
                          backgroundColor: palette.mutedSurface,
                        },
                      ]}
                      value={quitGoalDaysInput}
                      onChangeText={setQuitGoalDaysInput}
                      keyboardType="numeric"
                      placeholder={DEFAULT_QUIT_GOAL_DAYS_PLACEHOLDER}
                      placeholderTextColor={palette.textLight}
                      maxLength={4}
                    />
                  </View>
                  <Text style={[styles.shareHint, { color: palette.textMuted }]}>
                    {projectedQuitEndDate
                      ? `Target end date: ${projectedQuitEndDate}`
                      : 'Set how many days you want to aim for quitting.'}
                  </Text>
                </>
              ) : null}
              {showGoalUnitSheet ? (
                <View style={[styles.inlineSheet, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
                  <View style={[styles.segmentWrap, styles.goalUnitSegmentWrap, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
                    {GOAL_UNIT_CATEGORY_OPTIONS.map((category) => {
                      const selected = goalUnitCategory === category.value;
                      return (
                        <TouchableOpacity
                          key={category.value}
                          style={[styles.segment, styles.goalUnitSegment, selected && { backgroundColor: palette.habits }]}
                          onPress={() => setGoalUnitCategory(category.value)}
                        >
                          <Text style={[styles.segmentText, { color: selected ? '#FFFFFF' : palette.textMuted }]}>
                            {category.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.goalUnitChipGrid}>
                    {currentGoalUnitPresets.map((unit) => {
                      const selected = normalizedGoalUnit.toLowerCase() === unit.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={unit}
                          style={[
                            styles.goalUnitChip,
                            {
                              borderColor: selected ? palette.habits : palette.cardBorder,
                              backgroundColor: selected ? palette.habits : palette.card,
                            },
                          ]}
                          onPress={() => selectGoalUnit(unit)}
                          activeOpacity={0.9}
                        >
                          <Text style={[styles.goalUnitChipText, { color: selected ? '#FFFFFF' : palette.text }]}>
                            {unit}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={[styles.goalUnitChip, styles.goalUnitAddChip, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}
                      onPress={() => {
                        setCustomGoalUnitInput(isGoalUnitPreset ? '' : normalizedGoalUnit);
                        setShowCustomGoalUnitInput((prev) => !prev);
                      }}
                      activeOpacity={0.9}
                    >
                      <Ionicons name={showCustomGoalUnitInput ? 'close' : 'add'} size={18} color={palette.text} />
                    </TouchableOpacity>
                  </View>

                  {showCustomGoalUnitInput ? (
                    <View style={[styles.goalUnitCustomCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
                      <Text style={[styles.goalUnitCustomLabel, { color: palette.text }]}>Custom metric</Text>
                      <TextInput
                        style={[styles.formInput, styles.goalUnitCustomInput, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.mutedSurface }]}
                        placeholder="e.g. pages"
                        placeholderTextColor={palette.textLight}
                        value={customGoalUnitInput}
                        onChangeText={setCustomGoalUnitInput}
                        maxLength={24}
                      />
                      <View style={styles.goalUnitCustomActions}>
                        <TouchableOpacity
                          style={[styles.goalUnitCustomButton, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}
                          onPress={() => {
                            setShowCustomGoalUnitInput(false);
                            setCustomGoalUnitInput('');
                          }}
                        >
                          <Text style={[styles.goalUnitCustomButtonText, { color: palette.textMuted }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.goalUnitCustomButton, styles.goalUnitCustomButtonPrimary, { borderColor: palette.habits, backgroundColor: palette.habits }]}
                          onPress={applyCustomGoalUnit}
                        >
                          <Text style={[styles.goalUnitCustomButtonText, { color: '#FFFFFF' }]}>Use custom</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                  <TouchableOpacity style={[styles.sheetDone, { backgroundColor: palette.habits }]} onPress={closeGoalUnitSheet}>
                    <Text style={styles.sheetDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <TouchableOpacity style={styles.rowLine} onPress={toggleTaskDaysPicker}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>Task days</Text>
                <Text style={[styles.rowValue, { color: palette.textMuted }]}>
                  {formatTaskDaysSummary({ taskDaysMode, taskDaysCount, days: selectedDays, monthDays: selectedMonthDays })}
                </Text>
              </TouchableOpacity>
              {showTaskDaysSheet ? (
                <View style={[styles.inlineSheet, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
                  <TouchableOpacity style={[styles.sheetOption, styles.inlineSheetOption, { borderColor: taskDaysMode === 'every_day' ? palette.habits : palette.cardBorder, backgroundColor: palette.card }]} onPress={() => setTaskDaysMode('every_day')}>
                    <Text style={[styles.sheetOptionText, { color: palette.text }]}>Every day</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sheetOption, styles.inlineSheetOption, { borderColor: taskDaysMode === 'specific_weekdays' ? palette.habits : palette.cardBorder, backgroundColor: palette.card }]} onPress={() => setTaskDaysMode('specific_weekdays')}>
                    <Text style={[styles.sheetOptionText, { color: palette.text }]}>Specific weekdays</Text>
                  </TouchableOpacity>
                  {taskDaysMode === 'specific_weekdays' ? (
                    <View style={styles.wrapRow}>
                      {DAYS.map((day) => (
                        <TouchableOpacity key={day} style={[styles.pill, { backgroundColor: selectedDays.includes(day) ? palette.habits : palette.card, borderColor: selectedDays.includes(day) ? palette.habits : palette.cardBorder }]} onPress={() => toggleWeekday(day)}>
                          <Text style={[styles.pillText, { color: selectedDays.includes(day) ? '#FFFFFF' : palette.textMuted }]}>{day}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                  <TouchableOpacity style={[styles.sheetOption, styles.inlineSheetOption, { borderColor: taskDaysMode === 'specific_month_days' ? palette.habits : palette.cardBorder, backgroundColor: palette.card }]} onPress={() => setTaskDaysMode('specific_month_days')}>
                    <Text style={[styles.sheetOptionText, { color: palette.text }]}>Specific month days</Text>
                  </TouchableOpacity>
                  {taskDaysMode === 'specific_month_days' ? (
                    <View style={styles.monthDaysGrid}>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <TouchableOpacity key={day} style={[styles.monthDayChip, { backgroundColor: selectedMonthDays.includes(day) ? palette.habits : palette.card, borderColor: selectedMonthDays.includes(day) ? palette.habits : palette.cardBorder }]} onPress={() => toggleMonthDay(day)}>
                          <Text style={[styles.monthDayChipText, { color: selectedMonthDays.includes(day) ? '#FFFFFF' : palette.textMuted }]}>{day}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                  <TouchableOpacity style={[styles.sheetDone, { backgroundColor: palette.habits }]} onPress={() => setShowTaskDaysSheet(false)}>
                    <Text style={styles.sheetDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <View style={[styles.sectionCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Time range</Text>
              <View style={styles.wrapRow}>
                {TIME_RANGE_OPTIONS.map((option) => {
                  const selected = timeRange === option.value;
                  return (
                    <TouchableOpacity key={option.value} style={[styles.pill, { backgroundColor: selected ? palette.habits : palette.mutedSurface, borderColor: selected ? palette.habits : palette.cardBorder }]} onPress={() => setTimeRange(option.value)}>
                      <Text style={[styles.pillText, { color: selected ? '#FFFFFF' : palette.textMuted }]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.sectionCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Reminders</Text>
                <Switch
                  value={remindersEnabled}
                  onValueChange={(value) => {
                    setRemindersEnabled(value);
                    if (!value) {
                      setShowReminderTimePicker(false);
                      setEditingReminderTimeIndex(null);
                    }
                  }}
                  trackColor={{ false: palette.switchTrack, true: palette.habits }}
                />
              </View>
              {remindersEnabled ? (
                <>
                  <View style={styles.wrapRow}>
                    {reminderTimes.map((time, index) => (
                      <TouchableOpacity key={`${time}-${index}`} style={[styles.pill, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]} onPress={() => openReminderPicker(index)}>
                        <Text style={[styles.pillText, { color: palette.habits }]}>{time}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={[styles.pill, { borderColor: palette.habits, backgroundColor: palette.card }]} onPress={() => openReminderPicker(null)}>
                      <Text style={[styles.pillText, { color: palette.habits }]}>+ Time</Text>
                    </TouchableOpacity>
                  </View>
                  {Platform.OS === 'ios' && showReminderTimePicker ? (
                    <View style={[styles.inlineTimePickerCard, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
                      <DateTimePicker
                        value={reminderPickerDate}
                        mode="time"
                        display="spinner"
                        onChange={(_event, selectedDate) => {
                          if (!selectedDate) return;
                          setReminderPickerDate((prev) =>
                            prev?.getTime?.() === selectedDate.getTime() ? prev : selectedDate
                          );
                        }}
                        textColor={palette.text}
                      />
                      <View style={styles.inlineTimePickerActions}>
                        <TouchableOpacity
                          style={[styles.inlineTimePickerBtn, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}
                          onPress={() => {
                            setShowReminderTimePicker(false);
                            setEditingReminderTimeIndex(null);
                          }}
                        >
                          <Text style={[styles.inlineTimePickerBtnText, { color: palette.textMuted }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.inlineTimePickerBtn, { borderColor: palette.habits, backgroundColor: palette.habits }]}
                          onPress={() => applyReminderTime(reminderPickerDate, editingReminderTimeIndex)}
                        >
                          <Text style={[styles.inlineTimePickerBtnText, { color: '#FFFFFF' }]}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                  <TextInput style={[styles.formInput, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.mutedSurface }]} placeholder="Reminder message" placeholderTextColor={palette.textLight} value={reminderMessage} onChangeText={setReminderMessage} />
                </>
              ) : null}
            </View>

            <View style={[styles.sectionCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>Completion</Text>
                <Switch value={showMemoAfterCompletion} onValueChange={setShowMemoAfterCompletion} trackColor={{ false: palette.switchTrack, true: palette.habits }} />
              </View>
              <View style={styles.rowLine}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>Chart type</Text>
                <View style={[styles.segmentWrapSmall, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
                  <TouchableOpacity style={[styles.segmentSmall, chartType === 'bar' && { backgroundColor: palette.habits }]} onPress={() => setChartType('bar')}>
                    <Ionicons name="bar-chart" size={16} color={chartType === 'bar' ? '#FFFFFF' : palette.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.segmentSmall, chartType === 'line' && { backgroundColor: palette.habits }]} onPress={() => setChartType('line')}>
                    <Ionicons name="stats-chart" size={16} color={chartType === 'line' ? '#FFFFFF' : palette.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={styles.rowLine} onPress={openStartDatePicker}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>Started on</Text>
                <Text style={[styles.rowValue, { color: palette.textMuted }]}>{startDate}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rowLine} onPress={openEndDatePicker}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>
                  {habitType === 'quit' ? 'Target end date' : 'End date'}
                </Text>
                <Text style={[styles.rowValue, { color: palette.textMuted }]}>{endDate || 'No end'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rowLine}
                onPress={() => setEndDate(null)}
              >
                <Text style={[styles.rowLabel, { color: palette.text }]}>No end</Text>
                <Text style={[styles.rowValue, { color: palette.textMuted }]}>
                  {endDate ? 'Tap to clear' : 'Enabled'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.saveButton, { backgroundColor: habitTitle.trim() ? palette.habits : palette.cardBorder }]} onPress={submitHabit} disabled={!habitTitle.trim()}>
              <Text style={styles.saveButtonText}>{isEditingHabit ? 'Save changes' : 'Create habit'}</Text>
            </TouchableOpacity>
          </View>

          {showQuitHabitInfoModal ? (
            <View style={styles.quitInfoOverlay}>
              <View style={styles.quitInfoBackdrop} />
              <View
                style={[
                  styles.quitInfoCard,
                  { backgroundColor: palette.card, borderColor: palette.cardBorder },
                ]}
              >
                <View style={[styles.quitInfoIconWrap, { backgroundColor: withAlpha('#EF4444', 0.12) }]}>
                  <Ionicons name="close-circle-outline" size={32} color="#DC2626" />
                </View>
                <Text style={[styles.quitInfoTitle, { color: palette.text }]}>{'\u{1F44E} Quit Habit'}</Text>
                <Text style={[styles.quitInfoText, { color: palette.textMuted }]}>
                  You must not exceed your goal to complete a habit. If you don't do
                  anything to a habit, it is completed.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.quitInfoButton,
                    {
                      backgroundColor: withAlpha(palette.habits, 0.14),
                      borderColor: withAlpha(palette.habits, 0.38),
                    },
                  ]}
                  onPress={() => setShowQuitHabitInfoModal(false)}
                >
                  <Text style={[styles.quitInfoButtonText, { color: palette.habits }]}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <RNModal
        visible={showGoalUnitSheet && !showFormModal}
        transparent
        animationType="fade"
        onRequestClose={closeGoalUnitSheet}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeGoalUnitSheet} />
          <View
            style={[
              styles.sheetCardLarge,
              styles.goalUnitSheetCard,
              {
                backgroundColor: palette.card,
                borderColor: palette.cardBorder,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={[styles.goalUnitSheetHandle, { backgroundColor: palette.cardBorder }]} />
            <View style={styles.goalUnitSheetHeader}>
              <View style={styles.goalUnitSheetHeaderSpacer} />
              <Text style={[styles.sheetTitle, styles.goalUnitSheetTitle, { color: palette.text }]}>Select Unit</Text>
              <TouchableOpacity
                style={[styles.goalUnitEditButton, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}
                onPress={() => {
                  if (showCustomGoalUnitInput) {
                    setShowCustomGoalUnitInput(false);
                    setCustomGoalUnitInput('');
                    return;
                  }
                  setCustomGoalUnitInput(isGoalUnitPreset ? '' : normalizedGoalUnit);
                  setShowCustomGoalUnitInput(true);
                }}
              >
                <Feather
                  name={showCustomGoalUnitInput ? 'x' : 'edit-2'}
                  size={16}
                  color={palette.text}
                />
              </TouchableOpacity>
            </View>

            <View style={[styles.segmentWrap, styles.goalUnitSegmentWrap, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
              {GOAL_UNIT_CATEGORY_OPTIONS.map((category) => {
                const selected = goalUnitCategory === category.value;
                return (
                  <TouchableOpacity
                    key={category.value}
                    style={[styles.segment, styles.goalUnitSegment, selected && { backgroundColor: palette.habits }]}
                    onPress={() => setGoalUnitCategory(category.value)}
                  >
                    <Text style={[styles.segmentText, { color: selected ? '#FFFFFF' : palette.textMuted }]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.goalUnitChipGrid}>
              {currentGoalUnitPresets.map((unit) => {
                const selected = normalizedGoalUnit.toLowerCase() === unit.toLowerCase();
                return (
                  <TouchableOpacity
                    key={unit}
                    style={[
                      styles.goalUnitChip,
                      {
                        borderColor: selected ? palette.habits : palette.cardBorder,
                        backgroundColor: selected ? palette.habits : palette.mutedSurface,
                      },
                    ]}
                    onPress={() => selectGoalUnit(unit)}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.goalUnitChipText, { color: selected ? '#FFFFFF' : palette.text }]}>
                      {unit}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.goalUnitChip, styles.goalUnitAddChip, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}
                onPress={() => {
                  setCustomGoalUnitInput(isGoalUnitPreset ? '' : normalizedGoalUnit);
                  setShowCustomGoalUnitInput(true);
                }}
                activeOpacity={0.9}
              >
                <Ionicons name="add" size={18} color={palette.text} />
              </TouchableOpacity>
            </View>

            {showCustomGoalUnitInput ? (
              <View style={[styles.goalUnitCustomCard, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
                <Text style={[styles.goalUnitCustomLabel, { color: palette.text }]}>Custom metric</Text>
                <TextInput
                  style={[styles.formInput, styles.goalUnitCustomInput, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.card }]}
                  placeholder="e.g. pages"
                  placeholderTextColor={palette.textLight}
                  value={customGoalUnitInput}
                  onChangeText={setCustomGoalUnitInput}
                  maxLength={24}
                />
                <View style={styles.goalUnitCustomActions}>
                  <TouchableOpacity
                    style={[styles.goalUnitCustomButton, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}
                    onPress={() => {
                      setShowCustomGoalUnitInput(false);
                      setCustomGoalUnitInput('');
                    }}
                  >
                    <Text style={[styles.goalUnitCustomButtonText, { color: palette.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.goalUnitCustomButton, styles.goalUnitCustomButtonPrimary, { borderColor: palette.habits, backgroundColor: palette.habits }]}
                    onPress={applyCustomGoalUnit}
                  >
                    <Text style={[styles.goalUnitCustomButtonText, { color: '#FFFFFF' }]}>Use custom</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </RNModal>

      <Modal
        visible={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          if (selectedHabit?.__isGroupHabit) {
            setActiveGroupHabitId(null);
            setActiveGroupHabitGroupId(null);
          }
        }}
        hideHeader
        fullScreen
        containerStyle={{ paddingBottom: 0 }}
        contentStyle={{ paddingHorizontal: 0 }}
        contentContainerStyle={{ paddingBottom: 0, paddingTop: 0 }}
      >
        {selectedHabit ? (
          <View style={[styles.detailScreen, { backgroundColor: palette.background }]}>
            <PlatformScrollView
              style={styles.detailScroll}
              contentContainerStyle={[styles.detailScrollContent, { paddingTop: 0, paddingBottom: insets.bottom }]}
              automaticallyAdjustContentInsets={false}
              bounces={false}
              alwaysBounceVertical={false}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
            >
              <LinearGradient colors={[palette.background, palette.background]} style={[styles.detailHeader, { paddingTop: insets.top }]}>
                <View style={[styles.detailHeroGlowLeft, { backgroundColor: withAlpha(selectedHabitColor, 0.2) }]} />
                <View style={[styles.detailHeroGlowRight, { backgroundColor: withAlpha(selectedHabitColor, 0.14) }]} />
                <View style={styles.detailTopRow}>
                  <TouchableOpacity
                    style={[styles.detailIconButton, { backgroundColor: withAlpha(selectedHabitColor, 0.16), borderWidth: 1, borderColor: withAlpha(selectedHabitColor, 0.28) }]}
                    onPress={() => {
                      setShowDetailModal(false);
                      if (selectedHabit.__isGroupHabit) {
                        setActiveGroupHabitId(null);
                        setActiveGroupHabitGroupId(null);
                      }
                    }}
                  >
                    <Ionicons name="arrow-back" size={20} color={selectedHabitColor} />
                  </TouchableOpacity>
                  {selectedHabitLifecycleCompleted ? (
                    <View style={styles.detailTopActionsSpacer} />
                  ) : (
                    <View style={styles.detailTopActions}>
                      <TouchableOpacity
                        style={[styles.detailIconButton, styles.detailTopActionButton, { backgroundColor: withAlpha(selectedHabitColor, 0.16), borderWidth: 1, borderColor: withAlpha(selectedHabitColor, 0.28) }]}
                        onPress={openEditFromDetail}
                      >
                        <Feather name="edit-2" size={16} color={selectedHabitColor} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.detailIconButton, styles.detailTopActionButton, { backgroundColor: withAlpha(selectedHabitColor, 0.16), borderWidth: 1, borderColor: withAlpha(selectedHabitColor, 0.28) }]}
                        onPress={removeSelectedHabit}
                      >
                        <Ionicons name="trash-outline" size={17} color={selectedHabitColor} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.detailIdentityRow}>
                  <View style={[styles.detailHabitGlyph, { backgroundColor: withAlpha(selectedHabitColor, 0.14), borderColor: withAlpha(selectedHabitColor, 0.32) }]}>
                    <Text style={[styles.detailHabitGlyphText, { color: selectedHabitColor }]}>
                      {selectedHabit.emoji || selectedHabit.title?.slice(0, 1)?.toUpperCase() || 'H'}
                    </Text>
                  </View>
                  <View style={styles.detailHeaderText}>
                    <Text style={[styles.detailHeaderTitle, { color: palette.text }]}>{selectedHabit.title}</Text>
                    <Text style={[styles.detailHeaderSub, { color: palette.textMuted }]}>{selectedHabit.category || 'Personal'}</Text>
                    <Text style={[styles.detailHeaderMeta, { color: palette.textMuted }]}>
                      Started on {selectedHabitStartedOnLabel}
                    </Text>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.detailProgressCardWrap}>
                <View style={[styles.progressCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
                  <View style={styles.progressDateHeader}>
                    <TouchableOpacity
                      style={[styles.progressDateNav, { backgroundColor: palette.mutedSurface }]}
                      onPress={() => setSelectedDate((prev) => toStartOfDay(addDays(prev, -1)))}
                    >
                      <Ionicons name="chevron-back" size={17} color={palette.textMuted} />
                    </TouchableOpacity>
                    <View style={styles.progressDateTexts}>
                      <Text style={[styles.progressDatePrimary, { color: palette.text }]}>{selectedDatePrimaryLabel}</Text>
                      <Text style={[styles.progressDateSecondary, { color: palette.textMuted }]}>{selectedDateSecondaryLabel}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.progressDateNav, { backgroundColor: palette.mutedSurface }]}
                      onPress={() => setSelectedDate((prev) => toStartOfDay(addDays(prev, 1)))}
                    >
                      <Ionicons name="chevron-forward" size={17} color={palette.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.progressCircle, { borderColor: selectedHabitColor }]}>
                    <View style={[styles.progressCircleInner, { backgroundColor: withAlpha(selectedHabitColor, 0.07) }]}>
                      <Text style={[styles.progressPercent, { color: palette.text }]}>{selectedHabitPercent}%</Text>
                      <Text style={[styles.progressAmountTextLight, { color: palette.textMuted }]}>
                        {Math.round(selectedHabitAmount)}/{selectedHabitGoalValue} {selectedHabit.goalUnit || 'times'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.markBtn,
                      {
                        backgroundColor:
                          isSelectedDateToday && !selectedHabitLifecycleCompleted
                            ? selectedHabitColor
                            : palette.cardBorder,
                        borderColor:
                          isSelectedDateToday && !selectedHabitLifecycleCompleted
                            ? selectedHabitColor
                            : palette.cardBorder,
                      },
                    ]}
                    onPress={() => {
                      if (!isSelectedDateToday || selectedHabitLifecycleCompleted) return;
                      if (selectedHabitIsQuit) {
                        applyProgress(
                          selectedHabit,
                          selectedHabitIsOverdone ? 0 : getGoalValue(selectedHabit) + 1
                        );
                        return;
                      }
                      applyProgress(
                        selectedHabit,
                        selectedHabitCompletedForDate ? 0 : getGoalValue(selectedHabit)
                      );
                    }}
                    disabled={!isSelectedDateToday || selectedHabitLifecycleCompleted}
                  >
                    <Text style={styles.markBtnText}>
                      {selectedHabitLifecycleCompleted
                        ? 'Habit fully completed'
                        : !isSelectedDateToday
                        ? 'Only today can be updated'
                        : selectedHabitIsQuit
                          ? selectedHabitIsOverdone
                            ? 'Clear overdone status'
                            : 'Mark as overdone'
                          : selectedHabitCompletedForDate
                            ? 'Mark as incomplete'
                            : 'Mark as complete'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.completeHabitBtn,
                      {
                        backgroundColor: selectedHabitLifecycleCompleted
                          ? palette.mutedSurface
                          : withAlpha('#10B981', 0.14),
                        borderColor: selectedHabitLifecycleCompleted
                          ? palette.cardBorder
                          : withAlpha('#10B981', 0.45),
                      },
                    ]}
                    onPress={completeSelectedHabit}
                    disabled={selectedHabitLifecycleCompleted}
                  >
                    <Ionicons
                      name={selectedHabitLifecycleCompleted ? 'checkmark-circle' : 'checkmark-done-circle-outline'}
                      size={16}
                      color={selectedHabitLifecycleCompleted ? palette.textMuted : '#10B981'}
                    />
                    <Text
                      style={[
                        styles.completeHabitBtnText,
                        { color: selectedHabitLifecycleCompleted ? palette.textMuted : '#10B981' },
                      ]}
                    >
                      {selectedHabitLifecycleCompleted ? 'Habit completed' : 'Complete habit'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.detailMiniStatsRow}>
                <View style={[styles.detailMiniStatCard, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
                  <Ionicons name="flame-outline" size={16} color="#F97316" />
                  <Text style={[styles.detailMiniStatLabel, { color: palette.textMuted }]}>Current</Text>
                  <Text style={[styles.detailMiniStatValue, { color: palette.text }]}>{selectedHabit.streak || 0}</Text>
                  <Text style={[styles.detailMiniStatSuffix, { color: palette.textLight }]}>
                    {getStreakUnit(
                      selectedHabit?.goalPeriod || 'day',
                      (selectedHabit?.streak || 0) !== 1
                    )}
                  </Text>
                </View>
                <View style={[styles.detailMiniStatCard, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
                  <Feather name="target" size={16} color="#10B981" />
                  <Text style={[styles.detailMiniStatLabel, { color: palette.textMuted }]}>Goals</Text>
                  <Text style={[styles.detailMiniStatValue, { color: palette.text }]}>{selectedHabitGoalsThisMonth}</Text>
                  <Text style={[styles.detailMiniStatSuffix, { color: palette.textLight }]}>this month</Text>
                </View>
                <View style={[styles.detailMiniStatCard, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
                  <Ionicons name="trophy-outline" size={16} color="#F59E0B" />
                  <Text style={[styles.detailMiniStatLabel, { color: palette.textMuted }]}>Best</Text>
                  <Text style={[styles.detailMiniStatValue, { color: palette.text }]}>{selectedHabitBestStreak}</Text>
                  <Text style={[styles.detailMiniStatSuffix, { color: palette.textLight }]}>
                    {getStreakUnit(
                      selectedHabit?.goalPeriod || 'day',
                      selectedHabitBestStreak !== 1
                    )}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailLowerSection, { backgroundColor: palette.background }]}>
                <View style={[styles.detailStreakCard, { backgroundColor: detailCardColor }]}>
                  <Text style={styles.detailStreakBig}>
                    {selectedHabit.streak || 0}{' '}
                    {getStreakUnit(
                      selectedHabit?.goalPeriod || 'day',
                      (selectedHabit?.streak || 0) !== 1
                    )}
                  </Text>
                  <Text style={styles.detailStreakLabel}>Current streak</Text>
                  <View style={styles.detailStreakStatsRow}>
                    <View style={styles.detailStreakStat}>
                      <Text style={styles.detailStreakStatValue}>{selectedHabitCompletions}</Text>
                      <Text style={styles.detailStreakStatLabel}>Goals met</Text>
                    </View>
                    <View style={styles.detailStreakStat}>
                      <Text style={styles.detailStreakStatValue}>{selectedHabitBestStreak}</Text>
                      <Text style={styles.detailStreakStatLabel}>Best streak</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.calendarCard, { backgroundColor: shadeColor(selectedHabitColor, -0.42), borderColor: withAlpha('#FFFFFF', 0.12) }]}>
                  <View style={styles.calendarHeader}>
                    <Text style={[styles.calendarTitle, { color: '#EAF2FF' }]}>Monthly Progress</Text>
                    <View style={styles.calendarNav}>
                      <TouchableOpacity
                        style={[styles.calendarNavBtn, { backgroundColor: withAlpha('#FFFFFF', 0.12) }]}
                        onPress={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}
                      >
                        <Ionicons name="chevron-back" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={styles.calendarMonthText}>
                        {monthAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                      </Text>
                      <TouchableOpacity
                        style={[styles.calendarNavBtn, { backgroundColor: withAlpha('#FFFFFF', 0.12) }]}
                        onPress={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}
                      >
                        <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.calendarWeekRow}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                      <Text key={`${day}-${index}`} style={styles.calendarWeekDayText}>{day}</Text>
                    ))}
                  </View>
                  <View style={styles.calendarGrid}>
                    {monthCells.map((cell) => {
                      if (cell.type === 'spacer') return <View key={cell.key} style={styles.calendarCell} />;
                      const completed = (selectedHabit.completedDates || []).includes(cell.dateKey);
                      const selectedDay = cell.dateKey === selectedDateKey;
                      return (
                        <View key={cell.key} style={styles.calendarCell}>
                          <View
                            style={[
                              styles.calendarDot,
                              {
                                backgroundColor: completed ? selectedHabitColor : withAlpha('#FFFFFF', 0.1),
                                borderWidth: selectedDay ? 2 : 0,
                                borderColor: selectedDay ? '#FFFFFF' : 'transparent',
                              },
                            ]}
                          >
                            <Text style={[styles.calendarDotText, { color: '#F8FAFF' }]}>{cell.day}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </PlatformScrollView>
          </View>
        ) : null}
      </Modal>

      <PlatformDatePicker
        visible={showSelectedDatePicker}
        value={selectedDate}
        onClose={() => setShowSelectedDatePicker(false)}
        onChange={(date) => setSelectedDate(toStartOfDay(date))}
        accentColor={palette.habits}
      />
      <PlatformDatePicker
        visible={showStartDatePicker}
        value={parsedStartDate}
        onClose={() => setShowStartDatePicker(false)}
        onChange={handleStartDateChange}
        maximumDate={parsedEndDate || undefined}
        accentColor={palette.habits}
      />
      <PlatformDatePicker
        visible={showEndDatePicker}
        value={parsedEndDate || parsedStartDate}
        onClose={() => setShowEndDatePicker(false)}
        onChange={handleEndDateChange}
        minimumDate={parsedStartDate}
        accentColor={palette.habits}
      />
    </View>
  );
};

const createStyles = (palette) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.lg },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    pageTitle: { ...typography.h1, fontSize: 34, fontWeight: '700' },
    pageSubtitle: { ...typography.bodySmall, marginTop: 2 },
    iconButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerAddWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    headerSettingsButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      ...shadows.small,
    },
    headerAddButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.small,
    },
    addTypeDimOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(8,12,24,0.58)',
    },
    addTypeDimOverlayTouch: {
      ...StyleSheet.absoluteFillObject,
    },
    addTypeFloatingWrap: {
      position: 'absolute',
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    addTypeInlineMenu: {
      position: 'absolute',
      left: 21,
      top: 21,
      width: 0,
      height: 0,
    },
    addTypeInlinePill: {
      position: 'absolute',
      width: 120,
      height: 48,
      borderWidth: 1,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.small,
    },
    addTypeInlinePillPersonal: {
      left: -150,
      top: -24,
    },
    addTypeInlinePillGroup: {
      left: -110,
      top: 36,
    },
    addTypeInlinePillText: { ...typography.body, fontWeight: '700' },
    dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    dateArrow: {
      width: 42,
      height: 42,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    datePicker: {
      flex: 1,
      marginHorizontal: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateText: { ...typography.bodySmall, fontWeight: '700' },
    statsRow: { flexDirection: 'row', marginBottom: spacing.md },
    statCard: { flex: 1, marginHorizontal: 4, borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.md },
    statStreak: {
      backgroundColor: palette.isDark ? '#33261E' : '#FFF0E2',
      borderColor: palette.isDark ? '#5A3A2A' : '#F6D7B7',
    },
    statToday: {
      backgroundColor: palette.isDark ? '#1E2F28' : '#E8F8EE',
      borderColor: palette.isDark ? '#2D4F42' : '#CFEFD8',
    },
    statTotal: {
      backgroundColor: palette.isDark ? '#1C2A40' : '#E8F0FF',
      borderColor: palette.isDark ? '#2D4569' : '#CCDAFF',
    },
    statLabel: { ...typography.caption, marginTop: spacing.xs, color: palette.textMuted },
    statValue: { ...typography.h2, marginTop: 2, fontWeight: '700', color: palette.text },
    filterRow: { marginBottom: spacing.sm, flexDirection: 'row', flexWrap: 'wrap' },
    filterChip: { borderRadius: borderRadius.full, borderWidth: 1, paddingVertical: 9, paddingHorizontal: spacing.md, marginRight: spacing.sm, marginBottom: spacing.xs },
    filterChipText: { ...typography.bodySmall, fontWeight: '600' },
    notice: { borderRadius: borderRadius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    noticeText: { ...typography.bodySmall, marginLeft: spacing.sm, flex: 1 },
    emptyState: { borderRadius: borderRadius.xl, borderWidth: 1, alignItems: 'center', padding: spacing.xl, marginBottom: spacing.md },
    emptyTitle: { ...typography.h3, fontWeight: '700', marginTop: spacing.sm, marginBottom: spacing.md },
    emptyButton: { borderRadius: borderRadius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
    emptyButtonText: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700' },
    swipeRow: { minHeight: 122, marginBottom: spacing.md, justifyContent: 'center', overflow: 'hidden' },
    swipeTrack: { flexDirection: 'row', alignItems: 'center' },
    actionRailInline: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.sm },
    actionTile: { width: 64, height: 86, borderRadius: borderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
    actionTileEdit: { backgroundColor: '#EAF1FF', borderColor: '#D7E5FF' },
    actionTileSkip: { backgroundColor: '#FFF3E7', borderColor: '#FFE2C9' },
    actionTileReset: { backgroundColor: '#E9F8F3', borderColor: '#CDEFE2' },
    actionTileDelete: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
    actionText: { ...typography.caption, fontWeight: '700', marginTop: spacing.xs },
    habitWrapper: {
      borderRadius: borderRadius.xl,
      overflow: 'hidden',
      position: 'relative',
      ...shadows.small,
    },
    fillTrack: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: borderRadius.xl,
      overflow: 'hidden',
      zIndex: 0,
    },
    fillValue: { height: '100%' },
    habitCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      padding: spacing.md,
      minHeight: 110,
      backgroundColor: palette.card,
      position: 'relative',
      zIndex: 1,
      overflow: 'hidden',
    },
    androidFillOverlay: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 0,
    },
    habitCardContent: {
      position: 'relative',
      zIndex: 1,
    },
    habitRow: { flexDirection: 'row', alignItems: 'center' },
    habitAvatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
    habitAvatarText: { ...typography.h3, fontWeight: '700' },
    habitInfo: { flex: 1, marginRight: spacing.md },
    habitTitle: { ...typography.h3, fontWeight: '700', marginBottom: spacing.xs },
    habitMeta: { ...typography.caption, fontWeight: '600' },
    progressMeta: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 116 },
    progressStreakRow: { flexDirection: 'row', alignItems: 'center' },
    progressMetaStreak: { ...typography.bodySmall, fontWeight: '800', marginLeft: 4 },
    progressMetaPercent: { ...typography.bodySmall, fontWeight: '800', marginTop: 8 },
    quickAddButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xs,
    },
    habitHintRow: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    habitHint: { ...typography.caption, marginTop: spacing.sm, textAlign: 'center' },
    manualCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg },
    manualTitle: { ...typography.h3, fontWeight: '700' },
    manualSub: { ...typography.bodySmall, marginTop: 2, marginBottom: spacing.sm },
    manualInput: { borderWidth: 1, borderRadius: borderRadius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md, ...typography.body },
    manualStepRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
    manualStepBtn: {
      width: 48,
      height: 38,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: spacing.xs,
    },
    manualCompleteWrap: { marginTop: spacing.sm },
    manualCompleteButton: {
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    manualCompleteText: { ...typography.bodySmall, fontWeight: '700', marginLeft: spacing.xs },
    manualCompleteHint: { ...typography.caption, marginTop: spacing.xs, textAlign: 'center' },
    manualGoal: { ...typography.caption, marginTop: spacing.sm },
    manualButtons: { flexDirection: 'row', marginTop: spacing.md },
    manualBtn: { flex: 1, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: 'center', marginHorizontal: spacing.xs },
    manualBtnText: { ...typography.bodySmall, fontWeight: '700' },
    manualBtnTextWhite: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700' },
    quitInfoOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      zIndex: 40,
      elevation: 40,
    },
    quitInfoBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(8, 12, 24, 0.5)',
    },
    quitInfoCard: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 30,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
      alignItems: 'center',
      ...shadows.large,
    },
    quitInfoIconWrap: {
      width: 74,
      height: 74,
      borderRadius: 37,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    quitInfoTitle: {
      ...typography.h2,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    quitInfoText: {
      ...typography.body,
      textAlign: 'center',
      lineHeight: 30,
      marginBottom: spacing.lg,
    },
    quitInfoButton: {
      minWidth: 180,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
    },
    quitInfoButtonText: {
      ...typography.body,
      fontWeight: '700',
    },
    formScreen: { flex: 1 },
    formTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    formTitle: { ...typography.h3, fontWeight: '700' },
    formSpacer: { width: 38, height: 38 },
    formBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
    sectionCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
    sectionTitle: { ...typography.body, fontWeight: '700', marginBottom: spacing.sm },
    formIdentityRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: spacing.sm },
    formIdentityInputs: { flex: 1, marginRight: spacing.sm },
    formDescriptionInput: { marginBottom: 0 },
    formEmojiButton: {
      width: 70,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    formEmojiValue: { ...typography.h3 },
    formEmojiLabel: { ...typography.caption, marginTop: 2, fontWeight: '600' },
    emojiSelectorInline: {
      borderWidth: 1,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    formInput: { borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, ...typography.body, marginBottom: spacing.sm },
    formTextArea: { minHeight: 84, textAlignVertical: 'top' },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
    colorSwatch: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentWrap: { flexDirection: 'row', borderRadius: borderRadius.full, borderWidth: 1, padding: 3, marginBottom: spacing.sm },
    segment: { flex: 1, borderRadius: borderRadius.full, alignItems: 'center', paddingVertical: 9 },
    segmentText: { ...typography.body, fontWeight: '700' },
    rowLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(120,120,120,0.25)' },
    inlineSheet: {
      borderWidth: 1,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    inlineSheetOption: { marginBottom: spacing.xs },
    shareFriendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    shareFriendTextWrap: { flex: 1, marginRight: spacing.sm },
    shareFriendName: { ...typography.body, fontWeight: '600' },
    shareFriendUser: { ...typography.caption, marginTop: 2 },
    shareFriendAction: {
      borderWidth: 1,
      borderRadius: borderRadius.full,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    shareFriendActionText: { ...typography.bodySmall, fontWeight: '700' },
    shareHint: { ...typography.caption, marginTop: spacing.xs },
    rowLabel: { ...typography.body, fontWeight: '600', flex: 1, marginRight: spacing.sm },
    rowValue: { ...typography.bodySmall, fontWeight: '600' },
    goalInputs: { flexDirection: 'row', alignItems: 'center' },
    goalInput: { width: 80, borderWidth: 1, borderRadius: borderRadius.full, textAlign: 'center', paddingVertical: 6, marginLeft: spacing.xs, ...typography.bodySmall },
    goalDaysInput: { width: 96, marginLeft: 0 },
    goalUnitButton: {
      minWidth: 86,
      maxWidth: 136,
      borderWidth: 1,
      borderRadius: borderRadius.full,
      paddingVertical: 7,
      paddingHorizontal: spacing.sm,
      marginLeft: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    goalUnitButtonText: { ...typography.bodySmall, fontWeight: '600', marginRight: 6, flexShrink: 1 },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap' },
    pill: { borderRadius: borderRadius.full, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 7, marginRight: spacing.sm, marginBottom: spacing.sm },
    pillText: { ...typography.bodySmall, fontWeight: '600' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    segmentWrapSmall: { width: 120, borderRadius: borderRadius.full, borderWidth: 1, flexDirection: 'row', padding: 3 },
    segmentSmall: { flex: 1, borderRadius: borderRadius.full, alignItems: 'center', paddingVertical: 7 },
    saveButton: { borderRadius: borderRadius.full, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.xl },
    saveButtonText: { ...typography.body, color: '#FFFFFF', fontWeight: '700' },
    detailScreen: { flex: 1 },
    detailScroll: { flex: 1 },
    detailScrollContent: { paddingBottom: 0 },
    detailHeader: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
      borderBottomLeftRadius: 34,
      borderBottomRightRadius: 34,
      overflow: 'hidden',
      ...shadows.medium,
    },
    detailHeroGlowLeft: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: 'rgba(255,255,255,0.14)',
      top: -34,
      left: -46,
    },
    detailHeroGlowRight: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255,255,255,0.1)',
      top: 84,
      right: -34,
    },
    detailTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailTopActions: { flexDirection: 'row' },
    detailTopActionsSpacer: { width: 92 },
    detailTopActionButton: { marginLeft: spacing.sm },
    detailIconButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailIdentityRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
    detailHabitGlyph: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    detailHabitGlyphText: { ...typography.h1, color: '#FFFFFF', fontWeight: '700' },
    detailHeaderText: { flex: 1 },
    detailHeaderTitle: { ...typography.h1, color: '#FFFFFF', fontWeight: '800', fontSize: 36 },
    detailHeaderSub: { ...typography.bodySmall, color: 'rgba(255,255,255,0.88)', marginTop: 2, fontWeight: '700' },
    detailHeaderMeta: { ...typography.caption, color: 'rgba(255,255,255,0.78)', marginTop: 4, fontWeight: '600' },
    detailProgressCardWrap: {
      marginHorizontal: spacing.lg,
      marginTop: -12,
      borderRadius: borderRadius.xl,
      ...shadows.large,
    },
    progressCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      padding: spacing.lg,
      alignItems: 'center',
    },
    progressDateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: spacing.md },
    progressDateTexts: { alignItems: 'center' },
    progressDatePrimary: { ...typography.body, fontWeight: '700' },
    progressDateSecondary: { ...typography.caption, marginTop: 2 },
    detailGaugeSection: { alignItems: 'center', marginTop: spacing.lg },
    progressCircle: {
      width: 194,
      height: 194,
      borderRadius: 97,
      borderWidth: 9,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    progressCircleInner: {
      width: 152,
      height: 152,
      borderRadius: 76,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(8, 15, 31, 0.18)',
    },
    progressPercent: { ...typography.h1, fontWeight: '800', fontSize: 48 },
    progressAmountText: { ...typography.bodySmall, color: 'rgba(255,255,255,0.86)', marginTop: 4, fontWeight: '700' },
    progressAmountTextLight: { ...typography.bodySmall, marginTop: 4, fontWeight: '700' },
    markBtn: {
      borderRadius: borderRadius.full,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderWidth: 1,
    },
    markBtnText: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700' },
    completeHabitBtn: {
      marginTop: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    completeHabitBtnText: {
      ...typography.bodySmall,
      fontWeight: '700',
      marginLeft: spacing.xs,
    },
    progressDateRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
    progressDateNav: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: spacing.md,
    },
    progressDateTextHero: { ...typography.h3, color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.7 },
    detailMiniStatsRow: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
    detailMiniStatCard: {
      flex: 1,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginHorizontal: 4,
      minHeight: 110,
    },
    detailMiniStatLabel: { ...typography.caption, marginTop: spacing.xs },
    detailMiniStatValue: { ...typography.h2, fontWeight: '700', marginTop: 2 },
    detailMiniStatSuffix: { ...typography.caption, marginTop: 2 },
    detailLowerSection: {
      marginTop: spacing.md,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },
    detailStreakCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.13)',
      padding: spacing.lg,
      marginBottom: spacing.md,
      alignItems: 'center',
    },
    detailStreakBig: { ...typography.h1, color: '#DFF2FF', fontWeight: '800', fontSize: 44 },
    detailStreakLabel: { ...typography.body, color: 'rgba(223,242,255,0.82)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2, marginBottom: spacing.md },
    detailStreakStatsRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
    detailStreakStat: { flex: 1, alignItems: 'center' },
    detailStreakStatValue: { ...typography.h2, color: '#FFFFFF', fontWeight: '800' },
    detailStreakStatLabel: { ...typography.caption, color: 'rgba(223,242,255,0.7)', marginTop: 2, textTransform: 'uppercase' },
    calendarCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    calendarTitle: { ...typography.body, fontWeight: '700' },
    calendarNav: { flexDirection: 'row', alignItems: 'center' },
    calendarMonthText: { ...typography.bodySmall, color: '#EAF2FF', fontWeight: '700', marginHorizontal: spacing.sm },
    calendarNavBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    calendarWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, paddingHorizontal: 2 },
    calendarWeekDayText: { ...typography.caption, color: 'rgba(234,242,255,0.65)', width: '14.2%', textAlign: 'center' },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calendarCell: { width: '14.2%', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
    calendarDot: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    calendarDotText: { ...typography.caption, fontWeight: '700' },
    detailActions: { marginTop: spacing.xs },
    detailActionBtn: { borderRadius: borderRadius.lg, alignItems: 'center', paddingVertical: spacing.md, borderWidth: 1 },
    detailActionText: { ...typography.bodySmall, fontWeight: '700' },
    sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
    sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
    sheetCard: { borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg, maxHeight: '65%' },
    sheetCardLarge: { borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg, maxHeight: '82%' },
    goalUnitSheetCard: {
      paddingTop: spacing.sm,
    },
    goalUnitSheetHandle: {
      width: 52,
      height: 5,
      borderRadius: borderRadius.full,
      alignSelf: 'center',
      marginBottom: spacing.sm,
      opacity: 0.65,
    },
    goalUnitSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    goalUnitSheetHeaderSpacer: { width: 36, height: 36 },
    goalUnitEditButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goalUnitSheetTitle: { marginBottom: 0, flex: 1 },
    goalUnitSegmentWrap: { marginBottom: spacing.md },
    goalUnitSegment: { paddingVertical: 8 },
    goalUnitChipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    goalUnitChip: {
      width: '23.5%',
      borderWidth: 1,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
      minHeight: 52,
    },
    goalUnitAddChip: {
      borderStyle: 'dashed',
    },
    goalUnitChipText: { ...typography.body, fontWeight: '600' },
    goalUnitCustomCard: {
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.sm,
      marginTop: spacing.xs,
    },
    goalUnitCustomLabel: { ...typography.bodySmall, fontWeight: '700', marginBottom: spacing.xs },
    goalUnitCustomInput: { marginBottom: spacing.sm },
    goalUnitCustomActions: { flexDirection: 'row' },
    goalUnitCustomButton: {
      flex: 1,
      borderWidth: 1,
      borderRadius: borderRadius.full,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      marginHorizontal: 3,
    },
    goalUnitCustomButtonPrimary: {
      borderWidth: 1,
    },
    goalUnitCustomButtonText: { ...typography.bodySmall, fontWeight: '700' },
    sheetTitle: { ...typography.h3, fontWeight: '700', textAlign: 'center', marginBottom: spacing.md },
    sheetOption: { borderRadius: borderRadius.md, borderWidth: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
    sheetOptionText: { ...typography.body, fontWeight: '600' },
    emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing.sm },
    emojiOption: {
      width: '14.8%',
      aspectRatio: 1,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    emojiOptionText: { fontSize: 22 },
    monthDaysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    monthDayChip: { width: '13%', aspectRatio: 1, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    monthDayChipText: { ...typography.caption, fontWeight: '700' },
    inlineTimePickerCard: {
      borderWidth: 1,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    inlineTimePickerActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: spacing.xs,
    },
    inlineTimePickerBtn: {
      borderWidth: 1,
      borderRadius: borderRadius.full,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      marginLeft: spacing.sm,
    },
    inlineTimePickerBtnText: { ...typography.bodySmall, fontWeight: '700' },
    sheetDone: { borderRadius: borderRadius.full, alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
    sheetDoneText: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700' },
    completionMethodOption: {
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
    },
    completionMethodIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    completionMethodTextWrap: { flex: 1, marginRight: spacing.sm },
    completionMethodTitle: { ...typography.body, fontWeight: '700' },
    completionMethodDesc: { ...typography.caption, marginTop: 2 },
  });

export default HabitsScreen;
