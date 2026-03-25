import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card } from '../components';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows, borderRadius, spacing, typography } from '../utils/theme';
import useWeightManagerOverview from '../hooks/useWeightManagerOverview';

const MOOD_OPTIONS = [
  { key: 'happy', label: 'Happy', emoji: '\u{1F60A}', tone: 'positive', color: '#FFD166' },
  { key: 'loved', label: 'Loved', emoji: '\u{1F970}', tone: 'positive', color: '#FF8FAB' },
  { key: 'peaceful', label: 'Peaceful', emoji: '\u{1F60C}', tone: 'positive', color: '#A7F3D0' },
  { key: 'excited', label: 'Excited', emoji: '\u{1F929}', tone: 'positive', color: '#FDBA74' },
  { key: 'confident', label: 'Confident', emoji: '\u{1F60E}', tone: 'positive', color: '#60A5FA' },
  { key: 'celebrating', label: 'Celebrating', emoji: '\u{1F973}', tone: 'positive', color: '#F472B6' },
  { key: 'tired', label: 'Tired', emoji: '\u{1F634}', tone: 'neutral', color: '#A1A1AA' },
  { key: 'okay', label: 'Okay', emoji: '\u{1F610}', tone: 'neutral', color: '#FACC15' },
  { key: 'thoughtful', label: 'Thoughtful', emoji: '\u{1F914}', tone: 'neutral', color: '#C084FC' },
  { key: 'sad', label: 'Sad', emoji: '\u{1F622}', tone: 'negative', color: '#93C5FD' },
  { key: 'anxious', label: 'Anxious', emoji: '\u{1F630}', tone: 'negative', color: '#F59E0B' },
  { key: 'frustrated', label: 'Frustrated', emoji: '\u{1F624}', tone: 'negative', color: '#F87171' },
];

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const {
    themeColors,
    profile,
    habits,
    tasks,
    todayHealth,
    routines,
    groceryLists,
    groceries,
    notes,
    friends,
    friendRequests,
    taskInvites,
    getTodayTasks,
    getCurrentStreak,
    verifyNotePassword,
    updateNote,
    deleteNote,
    streakFrozen,
    ensureHomeDataLoaded,
    ensureRoutinesLoaded,
    ensureHealthLoaded,
    healthData,
    nutritionDailyTotals,
    themeName,
  } = useApp();
  const isDark = themeName === 'dark';
  const styles = React.useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);
  const isPremium = React.useMemo(() => {
    const plan = (profile?.plan || '').toString().toLowerCase();
    const expiresAt = profile?.premium_expires_at ? new Date(profile.premium_expires_at) : null;
    const stillActive = expiresAt ? expiresAt > new Date() : false;
    return !!(profile?.isPremium || plan === 'premium' || plan === 'paid' || stillActive);
  }, [profile]);

  const sectionListTheme = React.useMemo(
    () => ({
      reminders: {
        gradient: isDark ? ['#C56B1C', '#8E3E00'] : ['#FF8B1E', '#FF6A00'],
        border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.25)',
        iconBg: 'rgba(255,255,255,0.22)',
        iconColor: '#FFFFFF',
        text: '#FFFFFF',
        meta: 'rgba(255,255,255,0.8)',
        itemBg: 'rgba(255,255,255,0.2)',
      },
      overview: {
        gradient: isDark ? ['#3C4FE0', '#2E3AB6'] : ['#5B76FF', '#4352FF'],
        border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.2)',
        iconBg: 'rgba(255,255,255,0.22)',
        iconColor: '#FFFFFF',
        text: '#FFFFFF',
        meta: 'rgba(255,255,255,0.85)',
        dot: 'rgba(255,255,255,0.95)',
      },
      notes: {
        card: isDark ? '#12131C' : '#FFFFFF',
        border: isDark ? '#26293B' : '#EEE6FF',
        iconBg: isDark ? '#211E33' : '#F3E8FF',
        iconColor: isDark ? '#C084FC' : '#A855F7',
        itemBg: isDark ? '#1A1C2C' : '#F7F1FF',
        itemBorder: isDark ? '#2D3248' : '#EFE5FF',
        text: themeColors.text,
        meta: isDark ? '#C7C9D9' : themeColors.textSecondary,
        lock: isDark ? '#C084FC' : '#A855F7',
      },
      health: {
        gradient: isDark ? ['#D81B60', '#A80F44'] : ['#FF3B8D', '#FF1F7A'],
        border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.25)',
        iconBg: 'rgba(255,255,255,0.2)',
        iconColor: '#FFFFFF',
        text: '#FFFFFF',
        meta: 'rgba(255,255,255,0.82)',
      },
      weightManager: {
        gradient: isDark ? ['#0EA35B', '#06733F'] : ['#19D377', '#00B563'],
        border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.25)',
        iconBg: 'rgba(255,255,255,0.2)',
        iconColor: '#FFFFFF',
        text: '#FFFFFF',
        meta: 'rgba(255,255,255,0.82)',
        chipBg: isDark ? 'rgba(8, 32, 22, 0.35)' : 'rgba(255,255,255,0.2)',
      },
      habits: {
        gradient: isDark ? ['#5B35C9', '#3D2398'] : ['#8B5CF6', '#6D28D9'],
        border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.24)',
        card: isDark ? '#12131C' : '#FFFFFF',
        flatBorder: isDark ? '#2B2D40' : '#EEE6FF',
        iconBg: isDark ? '#7C3AED' : '#8B5CF6',
        iconColor: '#FFFFFF',
        chipBg: 'rgba(255,255,255,0.2)',
        bullet: isDark ? '#C084FC' : '#8B5CF6',
        text: '#FFFFFF',
        meta: 'rgba(255,255,255,0.85)',
      },
      lists: {
        gradient: ['#FFFFFF', '#FFFFFF'],
        border: '#E5E7EB',
        card: '#FFFFFF',
        flatBorder: '#E5E7EB',
        iconBg: '#F3F4F6',
        iconColor: '#111827',
        bulletBg: '#F3F4F6',
        bulletColor: '#16A34A',
        chipBg: '#F3F4F6',
        text: '#111827',
        meta: '#6B7280',
      },
    }),
    [isDark, themeColors]
  );

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const todayTasks = getTodayTasks();
  const toStartOfDay = React.useCallback((value) => {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return new Date(new Date().toDateString());
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }, []);
  const toUtcDayNumber = React.useCallback(
    (value) => {
      const date = toStartOfDay(value);
      return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    },
    [toStartOfDay]
  );
  const parseDateOnly = React.useCallback(
    (value) => {
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
    },
    [toStartOfDay]
  );
  const hasHabitReachedEndDate = React.useCallback(
    (habit, referenceDateValue = new Date()) => {
      if (!habit?.endDate) return false;
      const endDate = parseDateOnly(habit.endDate);
      const referenceDate = parseDateOnly(referenceDateValue);
      if (!endDate || !referenceDate) return false;
      return toUtcDayNumber(referenceDate) >= toUtcDayNumber(endDate);
    },
    [parseDateOnly, toUtcDayNumber]
  );
  const todayDateKey = React.useMemo(() => new Date().toDateString(), []);
  const getGoalValue = React.useCallback((habit) => {
    const rawValue = Number(habit?.goalValue);
    return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 1;
  }, []);
  const getHabitProgressForDate = React.useCallback(
    (habit, dateKey) => {
      const progressFromMap = Number(habit?.progressByDate?.[dateKey]);
      if (Number.isFinite(progressFromMap) && progressFromMap >= 0) {
        return progressFromMap;
      }
      if (Array.isArray(habit?.completedDates) && habit.completedDates.includes(dateKey)) {
        return getGoalValue(habit);
      }
      return 0;
    },
    [getGoalValue]
  );
  const normalizeStreakGoalPeriod = React.useCallback((value) => {
    const normalized = String(value || 'day').toLowerCase();
    if (normalized === 'week' || normalized === 'month') return normalized;
    return 'day';
  }, []);
  const getStreakPeriodIndex = React.useCallback(
    (value, goalPeriod = 'day') => {
      const period = normalizeStreakGoalPeriod(goalPeriod);
      const date = toStartOfDay(value);
      if (Number.isNaN(date.getTime())) return null;
      if (period === 'month') return date.getFullYear() * 12 + date.getMonth();
      const dayNumber = toUtcDayNumber(date);
      if (!Number.isFinite(dayNumber)) return null;
      if (period === 'week') return Math.floor((dayNumber + 3) / 7);
      return dayNumber;
    },
    [normalizeStreakGoalPeriod, toStartOfDay, toUtcDayNumber]
  );
  const computeBestStreakFromDateKeys = React.useCallback(
    (dateKeys = [], goalPeriod = 'day') => {
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
    },
    [getStreakPeriodIndex]
  );
  const getStreakUnit = React.useCallback((goalPeriod = 'day', plural = false) => {
    const normalized = String(goalPeriod || 'day').toLowerCase();
    if (normalized === 'week') return plural ? 'weeks' : 'week';
    if (normalized === 'month') return plural ? 'months' : 'month';
    if (normalized === 'year') return plural ? 'years' : 'year';
    return plural ? 'days' : 'day';
  }, []);
  const getHabitBestStreak = React.useCallback(
    (habit) => {
      const completedDatesBest = computeBestStreakFromDateKeys(
        habit?.completedDates || [],
        habit?.goalPeriod || 'day'
      );
      const currentStreak = Number(habit?.streak) || 0;
      return Math.max(currentStreak, completedDatesBest);
    },
    [computeBestStreakFromDateKeys]
  );
  const activeHabits = React.useMemo(
    () => (habits || []).filter((habit) => !hasHabitReachedEndDate(habit, new Date())),
    [habits, hasHabitReachedEndDate]
  );
  const achievedHabits = React.useMemo(
    () => (habits || []).filter((habit) => hasHabitReachedEndDate(habit, new Date())),
    [habits, hasHabitReachedEndDate]
  );
  const topStreakHabit = React.useMemo(() => {
    const candidateHabits = activeHabits.length ? activeHabits : achievedHabits;
    if (!candidateHabits.length) return null;
    return candidateHabits.reduce((currentTop, habit) => {
      if (!currentTop) return habit;
      const topValue = getHabitBestStreak(currentTop);
      const habitValue = getHabitBestStreak(habit);
      return habitValue > topValue ? habit : currentTop;
    }, null);
  }, [activeHabits, achievedHabits, getHabitBestStreak]);
  const topHabitIsAchieved = React.useMemo(
    () => (topStreakHabit ? hasHabitReachedEndDate(topStreakHabit, new Date()) : false),
    [topStreakHabit, hasHabitReachedEndDate]
  );
  const topHabitReferenceDateKey = React.useMemo(() => {
    if (!topStreakHabit) return todayDateKey;
    if (!topHabitIsAchieved) return todayDateKey;
    const endDate = parseDateOnly(topStreakHabit.endDate);
    if (endDate) return endDate.toDateString();
    const completedDates = Array.isArray(topStreakHabit.completedDates) ? topStreakHabit.completedDates : [];
    return completedDates.length ? completedDates[completedDates.length - 1] : todayDateKey;
  }, [parseDateOnly, todayDateKey, topHabitIsAchieved, topStreakHabit]);
  const topHabitGoalValue = topStreakHabit ? getGoalValue(topStreakHabit) : 0;
  const topHabitProgressValue = topStreakHabit
    ? Math.round(getHabitProgressForDate(topStreakHabit, topHabitReferenceDateKey))
    : 0;
  const topHabitProgressPercent = topStreakHabit && topHabitGoalValue > 0
    ? Math.min(100, Math.round((topHabitProgressValue / topHabitGoalValue) * 100))
    : 0;
  const topHabitStreakValue = topStreakHabit ? getHabitBestStreak(topStreakHabit) : 0;
  const topHabitStreakLabel = topStreakHabit
    ? `${topHabitIsAchieved ? 'Final streak: ' : ''}${topHabitStreakValue} ${getStreakUnit(topStreakHabit.goalPeriod, topHabitStreakValue !== 1)} streak`
    : '';
  const frozenStreakIconColor = '#4DA6FF';
  const topHabitCompletedToday = React.useMemo(
    () => (topStreakHabit ? (topStreakHabit.completedDates || []).includes(todayDateKey) : false),
    [todayDateKey, topStreakHabit]
  );
  const topHabitStreakIconColor =
    streakFrozen && !topHabitIsAchieved && !topHabitCompletedToday
      ? frozenStreakIconColor
      : '#FDBA74';
  const currentStreakIconColor = streakFrozen ? frozenStreakIconColor : '#FFFFFF';
  const parseClockMinutes = React.useCallback((value) => {
    if (!value || typeof value !== 'string') return null;
    const match = value
      .trim()
      .match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return null;

    let hour = Number(match[1]);
    const minute = Number(match[2] ?? '0');
    const suffix = (match[3] || '').toUpperCase();
    const hasSuffix = suffix === 'AM' || suffix === 'PM';

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    if (minute < 0 || minute > 59) return null;

    if (hasSuffix) {
      if (hour < 1 || hour > 12) return null;
      if (suffix === 'PM' && hour < 12) hour += 12;
      if (suffix === 'AM' && hour === 12) hour = 0;
    } else if (hour < 0 || hour > 23) {
      return null;
    }

    return hour * 60 + minute;
  }, []);
  const getRoutineStartTime = React.useCallback((routine) => {
    const legacyTimes = Array.isArray(routine?.scheduledTimes)
      ? routine.scheduledTimes
      : Array.isArray(routine?.scheduled_times)
      ? routine.scheduled_times
      : [];
    return routine?.startTime || routine?.start_time || legacyTimes[0] || '';
  }, []);
  const getRoutineEndTime = React.useCallback((routine) => {
    const legacyTimes = Array.isArray(routine?.scheduledTimes)
      ? routine.scheduledTimes
      : Array.isArray(routine?.scheduled_times)
      ? routine.scheduled_times
      : [];
    return routine?.endTime || routine?.end_time || legacyTimes[1] || '';
  }, []);
  const getNextRoutineOccurrence = React.useCallback(
    (routine, referenceDate = new Date()) => {
      const startMinutes = parseClockMinutes(getRoutineStartTime(routine));
      if (!Number.isFinite(startMinutes)) return null;
      const nextDate = new Date(referenceDate);
      nextDate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
      if (nextDate <= referenceDate) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      return nextDate;
    },
    [getRoutineStartTime, parseClockMinutes]
  );
  const nextUpcomingRoutine = React.useMemo(() => {
    const now = new Date();
    const candidates = (routines || [])
      .map((routine) => {
        const nextAt = getNextRoutineOccurrence(routine, now);
        if (!nextAt) return null;
        return { routine, nextAt };
      })
      .filter(Boolean)
      .sort((a, b) => a.nextAt - b.nextAt);

    if (candidates.length) return candidates[0];

    const fallbackRoutine = (routines || [])[0];
    return fallbackRoutine ? { routine: fallbackRoutine, nextAt: null } : null;
  }, [getNextRoutineOccurrence, routines]);
  const nextRoutineScheduleSummary = React.useMemo(() => {
    const routine = nextUpcomingRoutine?.routine;
    if (!routine) return '';
    const startTime = getRoutineStartTime(routine);
    const endTime = getRoutineEndTime(routine);
    if (startTime && endTime) return `${startTime} - ${endTime}`;
    if (startTime) return `Starts ${startTime}`;
    if (endTime) return `Ends ${endTime}`;
    return 'No range set';
  }, [getRoutineEndTime, getRoutineStartTime, nextUpcomingRoutine]);
  const nextRoutineOccurrenceLabel = React.useMemo(() => {
    if (!nextUpcomingRoutine) return '';
    if (!nextUpcomingRoutine.nextAt) return 'Add a start time to schedule this routine';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const targetStart = new Date(
      nextUpcomingRoutine.nextAt.getFullYear(),
      nextUpcomingRoutine.nextAt.getMonth(),
      nextUpcomingRoutine.nextAt.getDate()
    );

    let dayLabel = nextUpcomingRoutine.nextAt.toLocaleDateString('en-US', { weekday: 'short' });
    if (targetStart.getTime() === todayStart.getTime()) dayLabel = 'Today';
    if (targetStart.getTime() === tomorrowStart.getTime()) dayLabel = 'Tomorrow';

    const timeLabel = nextUpcomingRoutine.nextAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${dayLabel} at ${timeLabel}`;
  }, [nextUpcomingRoutine]);
  const groceryPreview = groceries.filter((g) => !g.completed).slice(0, 3);
  const totalListCount = (groceryLists || []).length;
  const totalOpenListItems = groceries.filter((item) => !item.completed).length;
  const totalCompletedListItems = groceries.filter((item) => item.completed).length;

  const normalizeMoodIndex = React.useCallback((value) => {
    if (!Number.isFinite(value)) return null;
    return Math.min(MOOD_OPTIONS.length - 1, Math.max(0, value - 1));
  }, []);
  const moodEntries = React.useMemo(() => {
    const entries = [];
    Object.entries(healthData || {}).forEach(([dateKey, data]) => {
      const idx = normalizeMoodIndex(data?.mood);
      if (idx !== null) {
        entries.push({
          dateKey,
          mood: MOOD_OPTIONS[idx],
        });
      }
    });
    entries.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    return entries;
  }, [healthData, normalizeMoodIndex]);
  const miniGardenFlowers = React.useMemo(
    () => moodEntries.slice(-5).map((entry) => entry.mood),
    [moodEntries]
  );
  const totalMoodCount = moodEntries.length;
  const currentStreak = getCurrentStreak ? getCurrentStreak() : 0;
  const todayNutritionKey = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const consumedCalories = Number.isFinite(nutritionDailyTotals?.[todayNutritionKey]?.calories)
    ? nutritionDailyTotals[todayNutritionKey].calories
    : todayHealth?.calories || 0;
  const calorieGoal = profile?.dailyCalorieGoal || 2000;
  const remainingCalories = Math.max(calorieGoal - consumedCalories, 0);
  const {
    weightManagerPlan,
    weightManagerTargetBody: targetBodyType,
    weightManagerStartingDisplay,
    weightManagerCurrentDisplay,
    weightManagerTargetDisplay,
  } = useWeightManagerOverview();
  const statGradients = {
    streak: isDark ? ['#C65A1F', '#8D2A00'] : ['#FF7A2D', '#FF4D2D'],
    calories: isDark ? ['#0EA35B', '#06733F'] : ['#19D377', '#00B563'],
  };
  const middleIconColors = {
    friends: isDark ? '#1D4ED8' : '#2563EB',
    focusBg: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EAF1FF',
    focusIcon: isDark ? '#93C5FD' : '#2563EB',
    countdownBg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FFF1DD',
    countdownIcon: isDark ? '#FCD34D' : '#EA580C',
  };
  const pendingFriendRequests = friendRequests?.incoming?.length || 0;
  const pendingTaskInvites = taskInvites?.incoming?.length || 0;
  const getInitial = React.useCallback((nameValue, usernameValue) => {
    const source = (nameValue || usernameValue || '?').trim();
    return (source[0] || '?').toUpperCase();
  }, []);
  const displayedFriends = React.useMemo(() => {
    return (friends || [])
      .slice()
      .sort((a, b) => {
        const aName = (a.username || a.name || '').toLowerCase();
        const bName = (b.username || b.name || '').toLowerCase();
        if (aName < bName) return -1;
        if (aName > bName) return 1;
        return 0;
      })
      .slice(0, 8);
  }, [friends]);
  const renderWeightManagerBodyType = React.useCallback(() => {
    if (!targetBodyType) {
      return (
        <View
          style={[
            styles.weightManagerBodyPlaceholder,
            { borderColor: sectionListTheme.weightManager.meta },
          ]}
        >
          <Text style={[styles.weightManagerBodyPlaceholderText, { color: sectionListTheme.weightManager.text }]}>
            ?
          </Text>
        </View>
      );
    }

    const silhouette = targetBodyType.silhouette || {};
    const scale = 0.55;
    const widthFor = (value, fallback) => Math.max(18, Math.round((value || fallback) * scale));
    const fillColor = sectionListTheme.weightManager.text;

    return (
      <View style={styles.weightManagerBodyPreview}>
        <View style={[styles.weightManagerBodyHead, { backgroundColor: fillColor }]} />
        <View
          style={[
            styles.weightManagerBodyShoulders,
            { backgroundColor: fillColor, width: widthFor(silhouette.shoulders, 40) },
          ]}
        />
        <View
          style={[
            styles.weightManagerBodyTorso,
            { backgroundColor: fillColor, width: widthFor(silhouette.torso, 32) },
          ]}
        />
        <View
          style={[
            styles.weightManagerBodyWaist,
            { backgroundColor: fillColor, width: widthFor(silhouette.waist, 28) },
          ]}
        />
        <View
          style={[
            styles.weightManagerBodyLegs,
            { backgroundColor: fillColor, width: widthFor(silhouette.waist, 28) },
          ]}
        />
      </View>
    );
  }, [sectionListTheme.weightManager.meta, sectionListTheme.weightManager.text, styles, targetBodyType]);

  const formatWeightManagerMacro = React.useCallback((value) => {
    if (!Number.isFinite(value)) return '--';
    return `${value} g`;
  }, []);
  const [selectedNote, setSelectedNote] = React.useState(null);
  const [noteToUnlock, setNoteToUnlock] = React.useState(null);
  const [notePasswordInput, setNotePasswordInput] = React.useState('');
  const [notePasswordError, setNotePasswordError] = React.useState('');
  const [unlockedNoteIds, setUnlockedNoteIds] = React.useState([]);
  const [focusToast, setFocusToast] = React.useState(route.params?.focusToast || '');
  const [noteTitleDraft, setNoteTitleDraft] = React.useState('');
  const [noteContentDraft, setNoteContentDraft] = React.useState('');
  const [showStreakFrozenModal, setShowStreakFrozenModal] = React.useState(false);

  React.useEffect(() => {
    ensureHomeDataLoaded();
    ensureRoutinesLoaded();
    ensureHealthLoaded();
  }, [
    ensureHomeDataLoaded,
    ensureHealthLoaded,
    ensureRoutinesLoaded,
  ]);

  const sortedNotes = React.useMemo(() => {
    return (notes || [])
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
      .slice(0, 3);
  }, [notes]);

  React.useEffect(() => {
    if (route.params?.focusToast) {
      setFocusToast(route.params.focusToast);
      const timer = setTimeout(() => setFocusToast(''), 4500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [route.params?.focusToast]);

  React.useEffect(() => {
    if (streakFrozen) {
      setShowStreakFrozenModal(true);
    } else {
      setShowStreakFrozenModal(false);
    }
  }, [streakFrozen]);

  const sectionButtons = [
    {
      id: 'habits',
      label: 'Habits',
      icon: 'target',
      iconType: 'feather',
      color: colors.habits,
      screen: 'Habits',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: 'edit-3',
      iconType: 'feather',
      color: colors.tasks,
      screen: 'Tasks',
    },
    {
      id: 'health',
      label: 'Health',
      icon: 'heart',
      iconType: 'ionicons',
      color: colors.health,
      screen: 'Health',
    },
    {
      id: 'routine',
      label: 'Routine',
      icon: 'history',
      iconType: 'material',
      color: colors.routine,
      screen: 'Routine',
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: 'trending-up',
      iconType: 'feather',
      color: colors.finance,
      screen: 'Finance',
    },
  ];

  const renderIcon = (icon, iconType, size, color) => {
    switch (iconType) {
      case 'feather':
        return <Feather name={icon} size={size} color={color} />;
      case 'material':
        return <MaterialCommunityIcons name={icon} size={size} color={color} />;
      default:
        return <Ionicons name={icon} size={size} color={color} />;
    }
  };

  const handleNotePress = (note) => {
    if (note.password && !unlockedNoteIds.includes(note.id)) {
      setNoteToUnlock(note);
      setNotePasswordInput('');
      setNotePasswordError('');
      return;
    }
    setSelectedNote(note);
    setNoteTitleDraft(note.title || '');
    setNoteContentDraft(note.content || '');
  };

  const closeNoteModal = () => {
    setSelectedNote(null);
    setNoteTitleDraft('');
    setNoteContentDraft('');
  };

  const closeUnlockModal = () => {
    setNoteToUnlock(null);
    setNotePasswordInput('');
    setNotePasswordError('');
  };

  const handleUnlockNote = () => {
    if (!noteToUnlock) return;
    const isValid = verifyNotePassword(noteToUnlock.id, notePasswordInput);
    if (!isValid) {
      setNotePasswordError('Incorrect password. Try again.');
      return;
    }
    setUnlockedNoteIds((prev) => [...prev, noteToUnlock.id]);
    setSelectedNote(noteToUnlock);
    setNoteTitleDraft(noteToUnlock.title || '');
    setNoteContentDraft(noteToUnlock.content || '');
    closeUnlockModal();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
      {!!focusToast && (
        <View style={styles.focusToast}>
          <Text style={styles.focusToastText}>{focusToast}</Text>
        </View>
      )}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <View style={[styles.logoDot, { backgroundColor: colors.habits }]} />
                <View style={[styles.logoDot, { backgroundColor: colors.tasks }]} />
                <View style={[styles.logoDot, { backgroundColor: colors.health }]} />
                <View style={[styles.logoDot, { backgroundColor: colors.routine }]} />
              </View>
              <Text style={styles.logoText}>Pillaflow</Text>
            </View>
            <View style={styles.headerRight}>
              {isPremium && (
                <View style={styles.premiumHeaderBadge}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.premiumHeaderShine}
                    pointerEvents="none"
                  />
                  <View style={styles.premiumHeaderContent}>
                    <Ionicons name="star" size={13} color="#FFFFFF" style={styles.premiumHeaderIcon} />
                    <Text style={styles.premiumHeaderText}>Premium</Text>
                  </View>
                </View>
              )}
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => navigation.navigate('NotificationCenter')}
              >
                <View>
                  <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
                  {(pendingFriendRequests > 0 || pendingTaskInvites > 0) && (
                    <View style={styles.notificationDot} />
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => navigation.navigate('Profile')}
              >
                {profile.photo ? (
                <Image source={{ uri: profile.photo }} style={styles.profileImage} />
              ) : (
                <Ionicons name="person-outline" size={24} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Shortcuts */}
        <View style={styles.sectionButtonsContainer}>
          {sectionButtons.map((section) => (
            <TouchableOpacity
              key={section.id}
              style={styles.sectionButton}
              onPress={() => navigation.navigate(section.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.sectionIconContainer, { backgroundColor: `${section.color}15` }]}>
                {renderIcon(section.icon, section.iconType, 24, section.color)}
              </View>
              <Text style={styles.sectionLabel}>{section.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Current Streak + Calories */}
        <View style={styles.topStatsRow}>
          <TouchableOpacity
            style={styles.statCardPressable}
            activeOpacity={0.88}
            onPress={() => navigation.navigate('Streak')}
          >
            <LinearGradient
              colors={statGradients.streak}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statCard}
            >
              <View style={styles.statIconWrap}>
                <Ionicons name="flame" size={20} color={currentStreakIconColor} />
              </View>
              <Text style={styles.statLabel}>Current streak</Text>
              <Text style={styles.statValue}>{currentStreak} day{currentStreak === 1 ? '' : 's'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <LinearGradient
            colors={statGradients.calories}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statCard}
          >
            <View style={styles.statIconWrap}>
              <Ionicons name="pulse" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.statLabel}>Remaining calories</Text>
            <Text style={styles.statValue}>{remainingCalories}</Text>
            <Text style={styles.statMeta}>Goal {calorieGoal}</Text>
          </LinearGradient>
        </View>

        {/* Friends */}
        <Card style={[styles.sectionCard, styles.middleCard]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Friends')}
          >
            <View style={styles.middleRow}>
              <View style={[styles.middleIconWrap, { backgroundColor: middleIconColors.friends }]}>
                <Ionicons name="people" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.middleTextWrap}>
                <Text style={styles.middleTitle}>Friends</Text>
                {friends.length === 0 ? (
                  <Text style={styles.middleSubtitle}>Find friends and manage invitations.</Text>
                ) : (
                  <Text style={styles.middleSubtitle}>
                    You have {friends.length} friend{friends.length === 1 ? '' : 's'}.
                  </Text>
                )}
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={themeColors?.textSecondary || colors.textSecondary}
              />
            </View>
            {friends.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.friendsPreviewScroll}
                contentContainerStyle={styles.friendsPreviewList}
              >
                {displayedFriends.map((friend) => (
                  <View
                    key={String(friend.id || friend.user_id || friend.username || friend.name)}
                    style={styles.friendPreviewItem}
                  >
                    <View style={styles.friendPreviewAvatarWrap}>
                      {friend.avatarUrl ? (
                        <Image source={{ uri: friend.avatarUrl }} style={styles.friendPreviewAvatar} />
                      ) : (
                        <View style={styles.friendPreviewAvatarFallback}>
                          <Text style={styles.friendPreviewInitial}>
                            {getInitial(friend.name, friend.username)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.friendPreviewName} numberOfLines={1}>
                      {friend.username || friend.name || 'Unknown user'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </TouchableOpacity>
        </Card>

        {/* Focus Mode + Countdown */}
        <View style={styles.topStatsRow}>
          <Card style={[styles.sectionCard, styles.miniCard]}>
            <TouchableOpacity
              style={styles.miniRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('FocusMode')}
            >
              <View style={[styles.miniIconWrap, { backgroundColor: middleIconColors.focusBg }]}>
                <Ionicons name="timer" size={20} color={middleIconColors.focusIcon} />
              </View>
              <Text style={styles.miniTitle}>Focus mode</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={themeColors?.textSecondary || colors.textSecondary}
              />
            </TouchableOpacity>
          </Card>

          <Card style={[styles.sectionCard, styles.miniCard]}>
            <TouchableOpacity
              style={styles.miniRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CountdownTimer')}
            >
              <View style={[styles.miniIconWrap, { backgroundColor: middleIconColors.countdownBg }]}>
                <Ionicons name="hourglass" size={20} color={middleIconColors.countdownIcon} />
              </View>
              <Text style={styles.miniTitle}>Countdown Timer</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={themeColors?.textSecondary || colors.textSecondary}
              />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Premium Upsell for free users */}
        {!isPremium && (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => navigation.navigate('Paywall', { source: 'home' })}
          >
            <LinearGradient
              colors={['#fbe7a1', '#f5c542', '#f3b11c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumUpsell}
            >
              <View style={styles.premiumShine} />
              <View style={styles.premiumIconWrap}>
                <Ionicons name="star" size={28} color="#b8860b" />
              </View>
              <View style={styles.premiumTextWrap}>
                <Text style={styles.premiumTitle}>Upgrade to Premium!</Text>
                <Text style={styles.premiumSubtitle}>
                  Unlock the AI agent and premium features tailored to power up your day.
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Today's Overview */}
        <Card
          style={[styles.sectionCard, styles.sectionCardGradient, styles.overviewCard]}
          onPress={() => navigation.navigate('Tasks')}
        >
          <LinearGradient
            colors={sectionListTheme.overview.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.sectionGradient,
              styles.overviewGradient,
              { borderColor: sectionListTheme.overview.border },
            ]}
          >
            <View style={styles.sectionContent}>
          <View style={styles.sectionListHeader}>
            <View style={styles.sectionListTitleRow}>
              <View
                style={[
                  styles.sectionListIcon,
                  { backgroundColor: sectionListTheme.overview.iconBg },
                ]}
              >
                <Ionicons name="calendar" size={16} color={sectionListTheme.overview.iconColor} />
              </View>
              <Text style={[styles.sectionListTitle, { color: sectionListTheme.overview.text }]}>
                Today's Overview
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={sectionListTheme.overview.text} />
          </View>
          <Text style={[styles.overviewDate, { color: sectionListTheme.overview.meta }]}>
            {formattedDate}
          </Text>
          {todayTasks.length > 0 ? (
            <View style={styles.tasksList}>
              {todayTasks.slice(0, 3).map((task) => (
                <View key={task.id} style={styles.taskItem}>
                  <View
                    style={[
                      styles.taskDot,
                      { backgroundColor: sectionListTheme.overview.dot },
                    ]}
                  />
                  <Text style={[styles.taskText, { color: sectionListTheme.overview.text }]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  {task.time && (
                    <Text style={[styles.taskTime, { color: sectionListTheme.overview.meta }]}>{task.time}</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.overviewEmpty, { color: sectionListTheme.overview.text }]}>
              No tasks scheduled for today
            </Text>
          )}
            </View>
          </LinearGradient>
        </Card>

        {/* Habits Overview */}
        <Card
          style={[styles.sectionCard, styles.sectionCardGradient]}
          onPress={() => navigation.navigate('Habits')}
        >
          <LinearGradient
            colors={sectionListTheme.habits.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.sectionGradient, { borderColor: sectionListTheme.habits.border }]}
          >
            <View style={styles.sectionContent}>
              <View style={styles.sectionListHeader}>
                <View style={styles.sectionListTitleRow}>
                  <View
                    style={[
                      styles.sectionListIcon,
                      { backgroundColor: sectionListTheme.habits.chipBg },
                    ]}
                  >
                    <Feather name="target" size={16} color={sectionListTheme.habits.iconColor} />
                  </View>
                  <Text style={[styles.sectionListTitle, { color: sectionListTheme.habits.text }]}>
                    Habits Overview
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={sectionListTheme.habits.text} />
              </View>
              {topStreakHabit ? (
                <View
                  style={[
                    styles.habitsTopCard,
                    { backgroundColor: sectionListTheme.habits.chipBg },
                  ]}
                >
                  <View style={styles.habitsTopRow}>
                    <View style={styles.habitsTopAvatar}>
                      <Text style={styles.habitsTopAvatarText}>
                        {topStreakHabit.emoji || topStreakHabit.title?.slice(0, 1)?.toUpperCase() || 'H'}
                      </Text>
                    </View>
                    <View style={styles.habitsTopInfo}>
                      <Text
                        style={[styles.habitsTopTitle, { color: sectionListTheme.habits.text }]}
                        numberOfLines={1}
                      >
                        {topStreakHabit.title || 'Untitled habit'}
                      </Text>
                      <Text
                        style={[styles.habitsTopMeta, { color: sectionListTheme.habits.meta }]}
                        numberOfLines={1}
                      >
                        {topHabitIsAchieved
                          ? 'This habit has been achieved'
                          : `${topHabitProgressValue} / ${topHabitGoalValue} ${topStreakHabit.goalUnit || 'times'}`}
                      </Text>
                    </View>
                    {!topHabitIsAchieved ? (
                      <Text style={[styles.habitsTopPercent, { color: sectionListTheme.habits.text }]}>
                        {topHabitProgressPercent}%
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.habitsTopStreakRow}>
                    <Ionicons
                      name={topHabitIsAchieved ? 'flag' : 'flame'}
                      size={14}
                      color={topHabitStreakIconColor}
                    />
                    <Text
                      style={[styles.habitsTopStreakText, { color: sectionListTheme.habits.text }]}
                      numberOfLines={1}
                    >
                      {topHabitStreakLabel}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.emptyText, { color: sectionListTheme.habits.meta }]}>
                  No habits yet
                </Text>
              )}
            </View>
          </LinearGradient>
        </Card>

        {/* Routines Overview */}
        <Card
          style={[styles.sectionCard, styles.sectionCardGradient]}
          onPress={() => navigation.navigate('Routine')}
        >
          <LinearGradient
            colors={sectionListTheme.reminders.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.sectionGradient, { borderColor: sectionListTheme.reminders.border }]}
          >
            <View style={styles.sectionContent}>
          <View style={styles.sectionListHeader}>
            <View style={styles.sectionListTitleRow}>
              <View
                style={[
                  styles.sectionListIcon,
                  { backgroundColor: sectionListTheme.reminders.iconBg },
                ]}
              >
                <Ionicons
                  name="sunny"
                  size={16}
                  color={sectionListTheme.reminders.iconColor}
                />
              </View>
              <Text style={[styles.sectionListTitle, { color: sectionListTheme.reminders.text }]}>
                Routines
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={sectionListTheme.reminders.text} />
          </View>
          {nextUpcomingRoutine === null ? (
            <Text style={[styles.emptyText, { color: sectionListTheme.reminders.meta }]}>
              No routines available
            </Text>
          ) : (
            <View style={styles.reminderList}>
              <View
                style={[
                  styles.reminderPill,
                  { backgroundColor: sectionListTheme.reminders.itemBg },
                ]}
              >
                <View
                  style={[
                    styles.reminderPillIcon,
                    { backgroundColor: sectionListTheme.reminders.iconBg },
                  ]}
                >
                  <Ionicons
                    name="sunny"
                    size={14}
                    color={sectionListTheme.reminders.iconColor}
                  />
                </View>
                <View style={styles.reminderContent}>
                  <Text
                    style={[styles.reminderTitle, { color: sectionListTheme.reminders.text }]}
                    numberOfLines={1}
                  >
                    {nextUpcomingRoutine.routine?.name || 'Untitled routine'}
                  </Text>
                  <Text style={[styles.reminderMeta, { color: sectionListTheme.reminders.meta }]}>
                    {nextRoutineScheduleSummary}
                  </Text>
                  <Text style={[styles.reminderMeta, { color: sectionListTheme.reminders.meta }]}>
                    {nextRoutineOccurrenceLabel}
                  </Text>
                </View>
              </View>
            </View>
          )}
            </View>
          </LinearGradient>
        </Card>

        {/* Mood Garden Overview */}
        <Card
          style={[styles.sectionCard, styles.sectionCardGradient]}
          onPress={() => navigation.navigate('Health')}
        >
          <LinearGradient
            colors={sectionListTheme.health.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.sectionGradient, { borderColor: sectionListTheme.health.border }]}
          >
            <View style={styles.sectionContent}>
              <View style={styles.moodOverviewHeader}>
                <View style={styles.moodOverviewHeaderLeft}>
                  <View
                    style={[
                      styles.sectionListIcon,
                      { backgroundColor: sectionListTheme.health.iconBg },
                    ]}
                  >
                    <Ionicons name="flower" size={16} color={sectionListTheme.health.iconColor} />
                  </View>
                  <View>
                    <Text style={[styles.sectionListTitle, { color: sectionListTheme.health.text }]}>
                      Mood Garden
                    </Text>
                    <Text style={[styles.moodOverviewSubtitle, { color: sectionListTheme.health.meta }]}>
                      How are you feeling?
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.moodOverviewPreview}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.25)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.moodOverviewPreviewGradient}
                >
                  {miniGardenFlowers.length ? (
                    <View style={styles.moodOverviewRow}>
                      {miniGardenFlowers.map((flower, idx) => (
                        <View key={`${flower.key}-${idx}`} style={styles.moodOverviewFlower}>
                          <View
                            style={[
                              styles.moodOverviewHead,
                              { backgroundColor: flower.color },
                            ]}
                          >
                            <Text style={styles.moodOverviewEmoji}>{flower.emoji}</Text>
                          </View>
                          <View style={styles.moodOverviewStem} />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.moodOverviewPlaceholder, { color: sectionListTheme.health.meta }]}>
                      Tap to plant your first flower.
                    </Text>
                  )}
                </LinearGradient>
              </View>

              <View style={styles.moodOverviewFooter}>
                <Text style={[styles.moodOverviewHint, { color: sectionListTheme.health.meta }]}>
                  Tap to plant today's mood
                </Text>
                <Text style={styles.moodOverviewCount}>
                  {totalMoodCount} flowers planted
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Card>

        {/* Lists Overview */}
        <Card
          style={[styles.sectionCard, styles.sectionCardGradient]}
          onPress={() => navigation.navigate('Routine')}
        >
          <LinearGradient
            colors={sectionListTheme.lists.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.sectionGradient, { borderColor: sectionListTheme.lists.border }]}
          >
            <View style={styles.sectionContent}>
              <View style={styles.sectionListHeader}>
                <View style={styles.sectionListTitleRow}>
                  <View
                    style={[
                      styles.sectionListIcon,
                      { backgroundColor: sectionListTheme.lists.chipBg },
                    ]}
                  >
                    <Ionicons name="list" size={16} color={sectionListTheme.lists.iconColor} />
                  </View>
                  <Text style={[styles.sectionListTitle, { color: sectionListTheme.lists.text }]}>
                    Lists Overview
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={sectionListTheme.lists.text} />
              </View>

              <View style={styles.listOverviewStatsRow}>
                <View style={[styles.listOverviewStatPill, { backgroundColor: sectionListTheme.lists.chipBg }]}>
                  <Text style={[styles.listOverviewStatValue, { color: sectionListTheme.lists.text }]}>
                    {totalListCount}
                  </Text>
                  <Text style={[styles.listOverviewStatLabel, { color: sectionListTheme.lists.meta }]}>Lists</Text>
                </View>
                <View style={[styles.listOverviewStatPill, { backgroundColor: sectionListTheme.lists.chipBg }]}>
                  <Text style={[styles.listOverviewStatValue, { color: sectionListTheme.lists.text }]}>
                    {totalOpenListItems}
                  </Text>
                  <Text style={[styles.listOverviewStatLabel, { color: sectionListTheme.lists.meta }]}>Open</Text>
                </View>
                <View style={[styles.listOverviewStatPill, { backgroundColor: sectionListTheme.lists.chipBg }]}>
                  <Text style={[styles.listOverviewStatValue, { color: sectionListTheme.lists.text }]}>
                    {totalCompletedListItems}
                  </Text>
                  <Text style={[styles.listOverviewStatLabel, { color: sectionListTheme.lists.meta }]}>Done</Text>
                </View>
              </View>

              {groceryPreview.length > 0 ? (
                <View style={styles.habitsOverviewList}>
                  {groceryPreview.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.habitsOverviewItem,
                        { backgroundColor: sectionListTheme.lists.chipBg },
                      ]}
                    >
                      <View
                        style={[
                          styles.habitsOverviewDot,
                          { backgroundColor: sectionListTheme.lists.bulletColor },
                        ]}
                      />
                      <Text
                        style={[styles.habitsOverviewText, { color: sectionListTheme.lists.text }]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.emptyText, { color: sectionListTheme.lists.meta }]}>
                  No open list items
                </Text>
              )}
            </View>
          </LinearGradient>
        </Card>

        {/* Quick Notes */}
        <Card
          style={[
            styles.sectionCard,
            styles.sectionCardFlat,
            { backgroundColor: sectionListTheme.notes.card, borderColor: sectionListTheme.notes.border },
          ]}
        >
          <View style={styles.sectionListHeader}>
            <View style={styles.sectionListTitleRow}>
              <View
                style={[
                  styles.sectionListIcon,
                  { backgroundColor: sectionListTheme.notes.iconBg },
                ]}
              >
                <Ionicons name="document-text" size={16} color={sectionListTheme.notes.iconColor} />
              </View>
              <Text style={[styles.sectionListTitle, { color: sectionListTheme.notes.text }]}>
                Quick Notes
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={sectionListTheme.notes.meta} />
          </View>
          {sortedNotes.length === 0 ? (
            <Text style={[styles.emptyText, { color: sectionListTheme.notes.meta }]}>
              No notes yet
            </Text>
          ) : (
            sortedNotes.map((note) => (
              <TouchableOpacity
                key={note.id}
                style={[
                  styles.quickNoteRow,
                  {
                    backgroundColor: sectionListTheme.notes.itemBg,
                    borderColor: sectionListTheme.notes.itemBorder,
                  },
                ]}
                onPress={() => handleNotePress(note)}
                activeOpacity={0.7}
              >
                <View style={styles.quickNoteInfo}>
                  <Text style={[styles.quickNoteTitle, { color: sectionListTheme.notes.text }]} numberOfLines={1}>
                    {note.title || 'Untitled note'}
                  </Text>
                  <Text style={[styles.quickNoteExcerpt, { color: sectionListTheme.notes.meta }]} numberOfLines={1}>
                    {note.content ? note.content : 'Tap to view'}
                  </Text>
                </View>
                {note.password && (
                  <Ionicons name="lock-closed" size={18} color={sectionListTheme.notes.lock} />
                )}
              </TouchableOpacity>
            ))
          )}
        </Card>

        {/* Note detail modal */}
        <Modal
          visible={!!selectedNote}
          animationType="slide"
          onRequestClose={closeNoteModal}
          presentationStyle="fullScreen"
        >
          <View style={[styles.fullScreenModal, { backgroundColor: themeColors.background }]}>
            <View style={styles.noteHeader}>
              <TouchableOpacity onPress={closeNoteModal} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>Close</Text>
              </TouchableOpacity>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => {
                    if (!selectedNote) return;
                    Alert.alert(
                      'Delete note',
                      'Are you sure you want to delete this note?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            await deleteNote(selectedNote.id);
                            closeNoteModal();
                          },
                        },
                      ]
                    );
                  }}
                  style={[styles.headerButton, styles.headerDelete]}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    if (!selectedNote) return;
                    await updateNote(selectedNote.id, {
                      title: noteTitleDraft || 'Untitled note',
                      content: noteContentDraft,
                    });
                    closeNoteModal();
                  }}
                  style={[styles.headerButton, styles.headerDone]}
                >
                  <Text style={[styles.headerButtonText, styles.doneButtonText]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView
              style={styles.noteDetailScroll}
              contentContainerStyle={styles.noteDetailContent}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                value={noteTitleDraft}
                onChangeText={setNoteTitleDraft}
                placeholder="Title"
                placeholderTextColor={colors.textSecondary}
                style={styles.noteTitleInput}
              />
              <TextInput
                value={noteContentDraft}
                onChangeText={setNoteContentDraft}
                placeholder="Start writing..."
                placeholderTextColor={colors.textSecondary}
                style={styles.noteContentInput}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>
          </View>
        </Modal>

        {/* Unlock modal */}
        <Modal
          visible={!!noteToUnlock}
          transparent
          animationType="fade"
          onRequestClose={closeUnlockModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Unlock note</Text>
              <Text style={styles.modalContent}>Enter the password to view this note.</Text>
              <TextInput
                value={notePasswordInput}
                onChangeText={(val) => {
                  setNotePasswordInput(val);
                  if (notePasswordError) setNotePasswordError('');
                }}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                style={styles.passwordInput}
              />
              {!!notePasswordError && (
                <Text style={styles.errorText}>{notePasswordError}</Text>
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSecondary]}
                  onPress={closeUnlockModal}
                >
                  <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalPrimary]}
                  onPress={handleUnlockNote}
                >
                  <Text style={styles.modalButtonText}>Unlock</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Streak frozen modal */}
        <Modal
          visible={showStreakFrozenModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStreakFrozenModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, styles.streakFreezeCard]}>
              <View style={styles.streakFreezeHeader}>
                <View style={styles.streakFreezeIconWrap}>
                  <Ionicons name="flame" size={28} color="#4da6ff" />
                </View>
                <Text style={styles.modalTitle}>Streak frozen</Text>
              </View>
              <Text style={styles.modalContent}>
                Your streak is frozen. Complete a habit today to unfreeze it.
              </Text>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalPrimary, styles.streakFreezeButton]}
                onPress={() => setShowStreakFrozenModal(false)}
              >
                <Text style={styles.modalButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Card
          style={[styles.sectionCard, styles.sectionCardGradient]}
          onPress={() => navigation.navigate('WeightManager')}
        >
            <LinearGradient
              colors={sectionListTheme.weightManager.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.sectionGradient, { borderColor: sectionListTheme.weightManager.border }]}
            >
              <View style={styles.sectionContent}>
                <View style={styles.sectionListHeader}>
                  <View style={styles.sectionListTitleRow}>
                    <View
                      style={[
                        styles.sectionListIcon,
                        { backgroundColor: sectionListTheme.weightManager.iconBg },
                      ]}
                    >
                      <Ionicons name="barbell" size={16} color={sectionListTheme.weightManager.iconColor} />
                    </View>
                    <Text style={[styles.sectionListTitle, { color: sectionListTheme.weightManager.text }]}>
                      Weight Manager
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={sectionListTheme.weightManager.text} />
                </View>

                <Text style={[styles.weightManagerSubtitle, { color: sectionListTheme.weightManager.meta }]}>
                  {targetBodyType?.label
                    ? `Target: ${targetBodyType.label}`
                    : 'Set your target body type'}
                </Text>

                {!weightManagerPlan && (
                  <Text style={[styles.weightManagerEmpty, { color: sectionListTheme.weightManager.meta }]}>
                    Add your current and target weights to unlock daily targets.
                  </Text>
                )}

                <View style={styles.weightManagerContent}>
                  <View style={styles.weightManagerWeights}>
                    <Text style={[styles.weightManagerLabel, { color: sectionListTheme.weightManager.meta }]}>
                      Starting
                    </Text>
                    <Text style={[styles.weightManagerValue, { color: sectionListTheme.weightManager.text }]}>
                      {weightManagerStartingDisplay}
                    </Text>
                    <Text style={[styles.weightManagerLabel, { color: sectionListTheme.weightManager.meta }]}>
                      Current
                    </Text>
                    <Text style={[styles.weightManagerValue, { color: sectionListTheme.weightManager.text }]}>
                      {weightManagerCurrentDisplay}
                    </Text>
                    <Text style={[styles.weightManagerLabel, { color: sectionListTheme.weightManager.meta }]}>
                      Target
                    </Text>
                    <Text style={[styles.weightManagerValue, { color: sectionListTheme.weightManager.text }]}>
                      {weightManagerTargetDisplay}
                    </Text>
                  </View>

                  <View style={styles.weightManagerTarget}>
                    <View
                      style={[
                        styles.weightManagerCalorieRing,
                        { borderColor: sectionListTheme.weightManager.text },
                      ]}
                    >
                      <Text style={[styles.weightManagerCalorieValue, { color: sectionListTheme.weightManager.text }]}>
                        {weightManagerPlan?.targetCalories ?? '--'}
                      </Text>
                      <Text style={[styles.weightManagerCalorieLabel, { color: sectionListTheme.weightManager.meta }]}>
                        cal/day
                      </Text>
                    </View>
                  </View>

                  <View style={styles.weightManagerBodyType}>
                    {renderWeightManagerBodyType()}
                    <Text style={[styles.weightManagerLabel, { color: sectionListTheme.weightManager.meta }]}>
                      Target type
                    </Text>
                    <Text style={[styles.weightManagerBodyLabel, { color: sectionListTheme.weightManager.text }]}>
                      {targetBodyType?.label || '--'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.weightManagerMacroRow, { backgroundColor: sectionListTheme.weightManager.chipBg }]}>
                  <View style={styles.weightManagerMacroItem}>
                    <Text style={[styles.weightManagerMacroLabel, { color: sectionListTheme.weightManager.meta }]}>
                      Protein
                    </Text>
                    <Text style={[styles.weightManagerMacroValue, { color: sectionListTheme.weightManager.text }]}>
                      {formatWeightManagerMacro(weightManagerPlan?.proteinGrams)}
                    </Text>
                  </View>
                  <View style={styles.weightManagerMacroItem}>
                    <Text style={[styles.weightManagerMacroLabel, { color: sectionListTheme.weightManager.meta }]}>
                      Carbs
                    </Text>
                    <Text style={[styles.weightManagerMacroValue, { color: sectionListTheme.weightManager.text }]}>
                      {formatWeightManagerMacro(weightManagerPlan?.carbsGrams)}
                    </Text>
                  </View>
                  <View style={styles.weightManagerMacroItem}>
                    <Text style={[styles.weightManagerMacroLabel, { color: sectionListTheme.weightManager.meta }]}>
                      Fat
                    </Text>
                    <Text style={[styles.weightManagerMacroValue, { color: sectionListTheme.weightManager.text }]}>
                      {formatWeightManagerMacro(weightManagerPlan?.fatGrams)}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </Card>

      </ScrollView>
    </View>
  );
};

const createStyles = (themeColorsParam = colors, isDark = false) => {
  const isAndroid = Platform.OS === 'android';
  const sectionCardColor = themeColorsParam?.card || colors.card;
  const sectionBorderColor = themeColorsParam?.border || colors.border || '#E5E7EB';
  const mutedBorder = isDark ? '#272A35' : '#EEE6FF';
  const flatShadow = isDark
    ? { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 }
    : shadows.small;
  const statShadow = isDark
    ? { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 }
    : shadows.medium;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isAndroid ? '#E9E1D7' : colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: isAndroid ? spacing.sm : spacing.xl,
      paddingBottom: 100,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: isAndroid ? 'flex-start' : 'center',
      paddingVertical: isAndroid ? spacing.sm : spacing.lg,
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoIcon: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: 28,
      height: 28,
      marginRight: spacing.sm,
    },
    logoDot: {
      width: 12,
      height: 12,
      borderRadius: 3,
      margin: 1,
    },
    logoText: {
      ...typography.h2,
      color: colors.text,
      fontSize: isAndroid ? 20 : typography.h2.fontSize,
      textTransform: isAndroid ? 'uppercase' : 'none',
      letterSpacing: isAndroid ? 1.4 : 0,
    },
    profileButton: {
      width: isAndroid ? 32 : 40,
      height: isAndroid ? 32 : 40,
      borderRadius: isAndroid ? 2 : borderRadius.full,
      backgroundColor: isAndroid ? '#D8CEC2' : colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
      ...(isAndroid ? {} : shadows.small),
    },
    profileImage: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: isAndroid ? 'flex-start' : 'center',
      gap: isAndroid ? spacing.xs : spacing.sm,
    },
    headerIconButton: {
      width: isAndroid ? 32 : 40,
      height: isAndroid ? 32 : 40,
      borderRadius: isAndroid ? 2 : borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isAndroid ? '#D8CEC2' : colors.inputBackground,
      ...(isAndroid ? {} : shadows.small),
    },
    notificationDot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 10,
      height: 10,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.card,
    },
    sectionButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    premiumHeaderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F59E0B',
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      position: 'relative',
      overflow: 'hidden',
      ...shadows.medium,
    },
    premiumHeaderContent: {
      flexDirection: 'row',
      alignItems: 'center',
      zIndex: 1,
    },
    premiumHeaderShine: {
      position: 'absolute',
      top: -6,
      left: -18,
      width: '70%',
      height: '140%',
      transform: [{ rotate: '-12deg' }],
      opacity: 0.75,
    },
    premiumHeaderIcon: {
      marginRight: spacing.xs,
    },
    premiumHeaderText: {
      ...typography.caption,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    sectionButton: {
      alignItems: 'center',
    },
    sectionIconContainer: {
      width: 52,
      height: 52,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    sectionLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    sectionCard: {
      marginBottom: isAndroid ? spacing.sm : spacing.lg,
    },
    sectionCardGradient: {
      padding: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      borderRadius: isAndroid ? 2 : borderRadius.xl,
      overflow: 'hidden',
    },
    sectionCardFlat: {
      borderWidth: 1,
      borderRadius: isAndroid ? 2 : borderRadius.xl,
      overflow: 'hidden',
    },
    sectionGradient: {
      borderRadius: isAndroid ? 2 : borderRadius.xl,
      padding: isAndroid ? spacing.sm : spacing.lg,
      borderWidth: isAndroid ? 2 : 1,
    },
    overviewCard: {
      borderRadius: isAndroid ? 2 : borderRadius.xxl,
      ...(isAndroid ? shadows.small : shadows.large),
    },
    overviewGradient: {
      borderRadius: isAndroid ? 2 : borderRadius.xxl,
      paddingVertical: isAndroid ? spacing.sm : spacing.lg,
      paddingHorizontal: isAndroid ? spacing.sm : spacing.lg,
    },
    sectionContent: {
      gap: spacing.sm,
    },
    habitsOverviewList: {
      gap: spacing.sm,
    },
    habitsOverviewItem: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    habitsOverviewDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.sm,
    },
    habitsOverviewText: {
      ...typography.bodySmall,
      fontWeight: '600',
      flex: 1,
    },
    habitsTopCard: {
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.26)',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    habitsTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    habitsTopAvatar: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.md,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    habitsTopAvatarText: {
      fontSize: 20,
    },
    habitsTopInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    habitsTopTitle: {
      ...typography.body,
      fontWeight: '700',
    },
    habitsTopMeta: {
      ...typography.caption,
      marginTop: 2,
      fontWeight: '600',
    },
    habitsTopPercent: {
      ...typography.body,
      fontWeight: '800',
    },
    habitsTopStreakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    habitsTopStreakText: {
      ...typography.bodySmall,
      fontWeight: '600',
      flex: 1,
    },
    listOverviewStatsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    listOverviewStatPill: {
      flex: 1,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listOverviewStatValue: {
      ...typography.h3,
      fontWeight: '800',
      lineHeight: 24,
    },
    listOverviewStatLabel: {
      ...typography.caption,
      fontWeight: '600',
      marginTop: 2,
    },
    sectionListHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sectionListTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionListIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    sectionListTitle: {
      ...typography.h3,
      fontWeight: '700',
    },
    topStatsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    statCard: {
      flex: 1,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      minHeight: 118,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.35)',
      ...statShadow,
    },
    statCardPressable: {
      flex: 1,
    },
    statIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.22)',
      marginBottom: spacing.sm,
    },
    statLabel: {
      ...typography.bodySmall,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '600',
      marginBottom: 2,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    statMeta: {
      ...typography.caption,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
    },
    middleCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: mutedBorder,
      backgroundColor: sectionCardColor,
      padding: spacing.lg,
      ...flatShadow,
    },
    middleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    middleIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    middleTextWrap: {
      flex: 1,
    },
    middleTitle: {
      ...typography.body,
      color: themeColorsParam?.text || colors.text,
      fontWeight: '700',
    },
    middleSubtitle: {
      ...typography.bodySmall,
      color: themeColorsParam?.textSecondary || colors.textSecondary,
      marginTop: 2,
    },
    friendsPreviewScroll: {
      marginTop: spacing.md,
    },
    friendsPreviewList: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingRight: spacing.sm,
    },
    friendPreviewItem: {
      alignItems: 'center',
      width: 72,
    },
    friendPreviewAvatarWrap: {
      width: 52,
      height: 52,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    friendPreviewAvatar: {
      width: '100%',
      height: '100%',
    },
    friendPreviewAvatarFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.primary}15`,
    },
    friendPreviewInitial: {
      ...typography.body,
      color: themeColorsParam?.text || colors.text,
      fontWeight: '700',
    },
    friendPreviewName: {
      ...typography.bodySmall,
      color: themeColorsParam?.text || colors.text,
      marginTop: spacing.xs,
      textAlign: 'center',
      width: '100%',
    },
    miniCard: {
      flex: 1,
      borderRadius: isAndroid ? 2 : borderRadius.lg,
      borderWidth: isAndroid ? 2 : 1,
      borderColor: mutedBorder,
      backgroundColor: sectionCardColor,
      paddingVertical: isAndroid ? spacing.sm : spacing.lg,
      paddingHorizontal: isAndroid ? spacing.sm : spacing.lg,
      minHeight: isAndroid ? 72 : 96,
      justifyContent: 'center',
      ...flatShadow,
    },
    miniRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    miniIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniTitle: {
      flex: 1,
      fontSize: 15,
      lineHeight: 20,
      color: themeColorsParam?.text || colors.text,
      fontWeight: '700',
    },
    lastCard: {
      marginBottom: spacing.xxxl,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    cardTitle: {
      ...typography.h3,
    },
    dateText: {
      ...typography.bodySmall,
      marginBottom: spacing.md,
    },
    overviewDate: {
      ...typography.bodySmall,
      fontWeight: '500',
      marginBottom: spacing.sm,
    },
    emptyText: {
      ...typography.bodySmall,
      color: colors.textLight,
    },
    overviewEmpty: {
      ...typography.bodySmall,
      fontWeight: '600',
    },
    tasksList: {
      marginTop: spacing.sm,
    },
    taskItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    taskDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.sm,
    },
    taskText: {
      flex: 1,
      ...typography.body,
    },
    taskTime: {
      ...typography.caption,
      marginLeft: spacing.sm,
    },
    tasksOverviewCard: {
      backgroundColor: colors.tasks,
      borderColor: colors.tasks,
    },
    tasksOverviewTitle: {
      color: '#FFFFFF',
    },
    tasksOverviewText: {
      color: '#FFFFFF',
    },
    tasksOverviewMeta: {
      color: '#FFFFFFCC',
    },
    tasksOverviewDot: {
      backgroundColor: '#FFFFFF',
    },
  moodOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  moodOverviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodOverviewSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  moodOverviewSparkle: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  moodOverviewPreview: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  moodOverviewPreviewGradient: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  moodOverviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  moodOverviewFlower: {
    alignItems: 'center',
  },
  moodOverviewHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  moodOverviewEmoji: {
    fontSize: 13,
  },
  moodOverviewStem: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#22C55E',
  },
  moodOverviewPlaceholder: {
    ...typography.bodySmall,
  },
  moodOverviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moodOverviewHint: {
    ...typography.caption,
  },
  moodOverviewCount: {
    ...typography.caption,
    fontWeight: '700',
    color: '#FBCFE8',
  },
  moodSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  moodSummaryEmoji: {
    fontSize: 32,
    marginRight: spacing.sm,
  },
  moodSummaryText: {
    ...typography.body,
    fontWeight: '600',
  },
  weightManagerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  weightManagerSubtitle: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  weightManagerEmpty: {
    ...typography.bodySmall,
    marginBottom: spacing.md,
  },
  weightManagerWeights: {
    flex: 1,
  },
  weightManagerLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  weightManagerValue: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  weightManagerTarget: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  weightManagerCalorieRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightManagerCalorieValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  weightManagerCalorieLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  weightManagerBodyType: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  weightManagerBodyLabel: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  weightManagerBodyPreview: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightManagerBodyPlaceholder: {
    width: 48,
    height: 64,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  weightManagerBodyPlaceholderText: {
    ...typography.body,
    fontWeight: '700',
  },
  weightManagerBodyHead: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: 2,
  },
  weightManagerBodyShoulders: {
    height: 6,
    borderRadius: 3,
    marginBottom: 2,
  },
  weightManagerBodyTorso: {
    height: 12,
    borderRadius: 5,
    marginBottom: 2,
  },
  weightManagerBodyWaist: {
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  weightManagerBodyLegs: {
    height: 12,
    borderRadius: 5,
  },
  weightManagerMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
  },
  weightManagerMacroItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  weightManagerMacroLabel: {
    ...typography.caption,
  },
  weightManagerMacroValue: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  weightManagerLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightManagerLockScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  weightManagerLockContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  weightManagerLockTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  weightManagerLockSubtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
    healthPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    healthPromptText: {
      ...typography.bodySmall,
      color: colors.health,
      marginLeft: spacing.sm,
    },
    healthCard: {
      backgroundColor: colors.health,
      borderColor: colors.health,
    },
    healthTitle: {
      color: '#FFFFFF',
    },
    healthText: {
      color: '#FFFFFF',
    },
    habitsList: {
      marginTop: spacing.sm,
    },
    habitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      marginBottom: spacing.xs,
    },
    habitDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: spacing.sm,
    },
    habitText: {
      ...typography.bodySmall,
      fontWeight: '500',
    },
    habitsPreviewCard: {
      borderRadius: borderRadius.xxl,
      borderWidth: 1,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      ...shadows.small,
      overflow: 'hidden',
    },
    habitsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    habitsTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    habitsIcon: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    habitsTitle: {
      ...typography.body,
      fontWeight: '700',
    },
    choreItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      marginBottom: spacing.sm,
    },
    choreBullet: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    choreText: {
      ...typography.body,
      flex: 1,
    },
    reminderList: {
      marginTop: spacing.sm,
    },
    reminderItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: '#FFFFFF33',
    },
    reminderPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.sm,
    },
    reminderPillIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    reminderContent: {
      flex: 1,
    },
    reminderTitle: {
      ...typography.body,
      fontWeight: '600',
    },
    reminderMeta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    remindersCard: {
      backgroundColor: colors.routine,
      borderColor: colors.routine,
    },
    remindersTitle: {
      color: '#FFFFFF',
    },
    remindersText: {
      color: '#FFFFFF',
    },
    remindersMeta: {
      color: '#FFFFFFCC',
    },
    healthCard: {
      backgroundColor: colors.health,
      borderColor: colors.health,
    },
    healthTitle: {
      color: '#FFFFFF',
    },
    healthText: {
      color: '#FFFFFF',
    },
    groceryPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    groceryText: {
      ...typography.bodySmall,
    },
    choresCard: {
      backgroundColor: '#1f4f2b',
      borderColor: '#163821',
    },
    choresTitle: {
      color: '#FFFFFF',
    },
    choresText: {
      color: '#FFFFFF',
    },
    habitsCard: {
      backgroundColor: colors.habits,
      borderColor: colors.habits,
    },
    habitsTitle: {
      color: '#FFFFFF',
    },
    habitsText: {
      color: '#FFFFFF',
    },
    bestStreakCard: {
      backgroundColor: sectionCardColor,
      borderColor: sectionBorderColor,
      flex: 1,
    },
    bestStreakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 72,
    },
    bestStreakIconWrap: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255, 77, 79, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    bestStreakTextWrap: {
      flex: 1,
    },
    bestStreakLabel: {
      ...typography.bodySmall,
      color: themeColorsParam?.textSecondary || colors.textSecondary,
      marginBottom: 2,
    },
    bestStreakValue: {
      ...typography.h2,
      color: themeColorsParam?.text || colors.text,
    },
    caloriesCard: {
      backgroundColor: sectionCardColor,
      borderColor: sectionBorderColor,
      flex: 1,
    },
    caloriesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 72,
    },
    insightsCard: {
      backgroundColor: themeColorsParam?.card || colors.card,
      borderColor: themeColorsParam?.border || colors.border || '#E5E7EB',
    },
    insightsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    insightsIconWrap: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      marginRight: spacing.md,
      ...shadows.small,
    },
    insightsTextWrap: {
      flex: 1,
    },
    insightsTitle: {
      ...typography.body,
      color: themeColorsParam?.text || colors.text,
      fontWeight: '800',
    },
    insightsSubtitle: {
      ...typography.caption,
      color: themeColorsParam?.textSecondary || colors.textSecondary,
      marginTop: 2,
    },
    caloriesIconWrap: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.full,
      backgroundColor: `${colors.success}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    caloriesTextWrap: {
      flex: 1,
    },
    caloriesLabel: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    caloriesValue: {
      ...typography.h2,
      color: colors.text,
    },
    caloriesGoalText: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    quickNotesCard: {
      backgroundColor: themeColorsParam?.card || colors.card,
      borderColor: themeColorsParam?.border || colors.border || '#E5E7EB',
    },
    focusCard: {
      backgroundColor: sectionCardColor,
      borderColor: sectionBorderColor,
      flex: 1,
    },
    focusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 72,
    },
    focusIconWrap: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.full,
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    focusIconWrapAccent: {
      backgroundColor: 'rgba(29, 84, 222, 0.12)',
    },
    focusTextWrap: {
      flex: 1,
    },
    focusLabel: {
      ...typography.bodySmall,
      color: '#FFFFFF',
      marginBottom: 2,
    },
    focusAccentText: {
      color: '#1d54de',
      fontWeight: '700',
    },
    focusValue: {
      ...typography.h2,
      color: '#FFFFFF',
    },
    countdownCard: {
      backgroundColor: sectionCardColor,
      borderColor: sectionBorderColor,
      flex: 1,
    },
    countdownIconWrapAccent: {
      backgroundColor: 'rgba(184, 111, 22, 0.12)',
    },
    countdownAccentText: {
      color: '#b86f16',
      fontWeight: '700',
    },
    focusButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
    },
    focusButtonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '700',
    },
    focusButtonTextSecondary: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    focusActions: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: spacing.sm,
    },
    focusSecondary: {
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      borderWidth: 1,
      borderColor: sectionBorderColor,
    },
    focusExit: {
      backgroundColor: colors.danger,
    },
    quickNoteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.sm,
    },
    quickNoteInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    quickNoteTitle: {
      ...typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    quickNoteExcerpt: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 2,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    modalCard: {
      width: '100%',
      borderRadius: borderRadius.xl,
      backgroundColor: themeColorsParam?.card || colors.card,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border || '#E5E7EB',
    },
    modalTitle: {
      ...typography.h3,
      marginBottom: spacing.sm,
      color: colors.text,
    },
    modalContent: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.md,
    },
    modalButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
    },
    modalPrimary: {
      backgroundColor: colors.primary,
    },
    modalSecondary: {
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    modalButtonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '600',
    },
    modalButtonTextSecondary: {
      ...typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    streakFreezeCard: {
      borderColor: '#4da6ff',
      borderWidth: 1,
    },
    streakFreezeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    streakFreezeIconWrap: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(77, 166, 255, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    streakFreezeButton: {
      marginTop: spacing.sm,
    },
    passwordInput: {
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border || '#E5E7EB',
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      color: colors.text,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
      marginBottom: spacing.sm,
    },
    fullScreenModal: {
      flex: 1,
    },
    headerButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    headerButtonText: {
      ...typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    doneButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    noteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl * 3 + spacing.sm,
      paddingBottom: spacing.md,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerDelete: {
      marginRight: spacing.sm,
    },
    headerDone: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
    },
    noteDetailScroll: {
      flex: 1,
    },
    noteDetailContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl + spacing.sm,
      paddingBottom: spacing.xl,
    },
    noteTitleInput: {
      ...typography.h2,
      color: colors.text,
      marginBottom: spacing.md,
    },
    noteContentInput: {
      ...typography.body,
      color: colors.text,
      flex: 1,
      padding: spacing.md,
      backgroundColor: 'transparent',
      lineHeight: 22,
    },
    deleteText: {
      ...typography.body,
      color: colors.danger,
      fontWeight: '600',
    },
    premiumUpsell: {
      flexDirection: 'row',
      alignItems: 'center',
      borderColor: '#b8860b',
      borderWidth: 3,
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
      ...shadows.large,
      overflow: 'hidden',
      position: 'relative',
    },
    premiumIconWrap: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: '#f1c232',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.lg,
      borderWidth: 2,
      borderColor: '#b8860b',
    },
    premiumShine: {
      position: 'absolute',
      top: 0,
      left: -120,
      width: 160,
      height: '120%',
      backgroundColor: 'rgba(255,255,255,0.35)',
      transform: [{ rotate: '20deg' }],
    },
    premiumTextWrap: {
      flex: 1,
    },
    premiumTitle: {
      ...typography.h2,
      color: '#4a3b00',
      marginBottom: spacing.xs,
    },
    premiumSubtitle: {
      ...typography.body,
      color: '#4a3b00',
    },
    focusToast: {
      position: 'absolute',
      top: spacing.xxxl * 2,
      left: spacing.xl,
      right: spacing.xl,
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: borderRadius.xl,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.xl,
      ...shadows.medium,
      zIndex: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    focusToastText: {
      ...typography.h3,
      color: colors.text,
      textAlign: 'center',
      fontWeight: '700',
    },
  });
};

export default HomeScreen;



