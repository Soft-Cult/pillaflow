import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import {
  Card,
  Modal,
  Input,
  ChipGroup,
  PlatformScrollView,
  PlatformDatePicker,
  PlatformTimePicker,
} from '../components';
import { formatTimeFromDate } from '../utils/notifications';
import {
  borderRadius,
  shadows,
  spacing,
  typography,
} from '../utils/theme';
import {
  ROUTINE_REPEAT,
  ROUTINE_REPEAT_OPTIONS,
  ROUTINE_WEEKDAY_LABELS,
  normalizeRoutineDays,
  normalizeRoutineRepeat,
  getRoutineDaysForRepeat,
  isRoutineScheduleValid,
  getRoutineScheduleLabel,
} from '../utils/routineSchedule';

const REMINDER_TIME_OPTIONS = Array.from({ length: 48 }).map((_, idx) => {
  const h = Math.floor(idx / 2);
  const m = idx % 2 === 0 ? '00' : '30';
  const hour12 = ((h + 11) % 12) + 1;
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${m} ${suffix}`;
});

const REMINDER_QUICK_TIMES = ['09:00', '12:00', '15:00', '18:00', '20:00'];
const ROUTINE_MONTH_DAY_OPTIONS = Array.from({ length: 31 }).map((_, index) => index + 1);

const ROUTINE_SUGGESTIONS = [
  'Morning Routine',
  'Night Routine',
  'Workout Flow',
  'Study Session',
];
const ROUTINE_CREATE_TYPES = [
  { label: 'Personal', value: 'personal' },
  { label: 'Group', value: 'group' },
];

const DEFAULT_GROCERY_EMOJI = '\uD83D\uDED2';
const GROCERY_EMOJI_OPTIONS = [
  DEFAULT_GROCERY_EMOJI,
  '\uD83C\uDF4E',
  '\uD83E\uDD57',
  '\uD83C\uDF73',
  '\uD83C\uDFCB\uFE0F',
  '\uD83C\uDF92',
  '\uD83C\uDFD6\uFE0F',
  '\uD83C\uDF89',
];

const QUICK_LIST_TEMPLATES = [
  { id: 'quick-grocery', name: 'Grocery List', emoji: DEFAULT_GROCERY_EMOJI },
  { id: 'quick-chores', name: 'Chores List', emoji: '\uD83C\uDFE0' },
  { id: 'quick-meal', name: 'Meal Prep', emoji: '\uD83C\uDF7D\uFE0F' },
  { id: 'quick-travel', name: 'Travel List', emoji: '\u2708\uFE0F' },
];

const normalizeTimeValue = (value) => {
  if (!value || typeof value !== 'string') return '';
  const match = value.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return value;
  let hour = parseInt(match[1], 10);
  const minute = match[2] ?? '00';
  const suffix = match[3]?.toUpperCase();
  if (suffix === 'PM' && hour < 12) hour += 12;
  if (suffix === 'AM' && hour === 12) hour = 0;
  const paddedHour = hour.toString().padStart(2, '0');
  return `${paddedHour}:${minute}`;
};

const parseClockMinutes = (value) => {
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
};

const normalizeRoutineTimeValue = (value) => {
  const minutes = parseClockMinutes(value);
  if (minutes === null) return '';
  const nextDate = new Date();
  nextDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return formatTimeFromDate(nextDate);
};

const normalizeRoutineTimeRange = (source = {}) => {
  const legacyTimes = Array.isArray(source?.scheduledTimes)
    ? source.scheduledTimes
    : Array.isArray(source?.scheduled_times)
    ? source.scheduled_times
    : [];
  const startCandidate =
    source?.startTime !== undefined
      ? source.startTime
      : source?.start_time !== undefined
      ? source.start_time
      : legacyTimes[0];
  const endCandidate =
    source?.endTime !== undefined
      ? source.endTime
      : source?.end_time !== undefined
      ? source.end_time
      : legacyTimes[1];

  return {
    startTime: normalizeRoutineTimeValue(startCandidate),
    endTime: normalizeRoutineTimeValue(endCandidate),
  };
};

const getRoutineDurationLabel = (startTime, endTime) => {
  const startMinutes = parseClockMinutes(startTime);
  const endMinutes = parseClockMinutes(endTime);
  if (startMinutes === null || endMinutes === null) return '';

  const diffMinutes = ((endMinutes - startMinutes) + 1440) % 1440;
  if (!diffMinutes) return '24h';
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
};

const formatRoutineTimeRangeSummary = (routine) => {
  const { startTime, endTime } = normalizeRoutineTimeRange(routine);
  if (!startTime && !endTime) return 'No range set';
  if (!startTime) return `Ends ${endTime}`;
  if (!endTime) return `Starts ${startTime}`;
  const duration = getRoutineDurationLabel(startTime, endTime);
  return duration
    ? `${startTime} - ${endTime} (${duration})`
    : `${startTime} - ${endTime}`;
};

const formatRoutineScheduleSummary = (routine) => {
  const scheduleLabel = getRoutineScheduleLabel(routine?.repeat, routine?.days);
  const timeLabel = formatRoutineTimeRangeSummary(routine);
  if (!timeLabel) return scheduleLabel;
  return `${scheduleLabel} - ${timeLabel}`;
};

const RoutineScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
    const {
      routines,
      groupRoutines,
      reminders,
    groceryLists,
    groceries,
    addRoutine,
    addGroupRoutine,
      addReminder,
      deleteReminder,
      addGroceryList,
      updateGroceryList,
      deleteGroceryList,
      addGroceryItem,
      toggleGroceryItem,
      deleteGroceryItem,
      clearCompletedGroceries,
      groups,
      themeName,
      themeColors,
      ensureRoutinesLoaded,
      ensureRemindersLoaded,
      ensureGroceriesLoaded,
    } = useApp();
    const isDark = themeName === 'dark';
    const palette = useMemo(
      () => ({
        isDark,
        routine: themeColors?.routine,
        tasks: themeColors?.tasks,
        info: themeColors?.info,
        health: themeColors?.health,
        finance: themeColors?.finance,
        text: themeColors?.text,
        textMuted: themeColors?.textSecondary,
        textLight: themeColors?.textLight,
        background: isDark ? '#120F1B' : '#F6F2FB',
        card: isDark ? '#1F1A2D' : '#FFFFFF',
        cardBorder: isDark ? '#3C3551' : '#E8DDF7',
        mutedSurface: isDark ? '#1A1626' : '#F8F4FC',
      }),
      [isDark, themeColors]
    );
    const sectionThemes = useMemo(
      () => ({
        routine: {
          card: palette.card,
          header: palette.mutedSurface,
          border: palette.cardBorder,
          accent: palette.routine,
          iconBg: palette.routine,
          iconColor: '#FFFFFF',
          actionBg: palette.mutedSurface,
          actionText: palette.text,
          sectionBg: palette.mutedSurface,
          itemBg: palette.card,
          itemBorder: palette.cardBorder,
          muted: palette.textMuted,
        },
        group: {
          card: palette.card,
          header: palette.mutedSurface,
          border: palette.cardBorder,
          accent: palette.tasks,
          iconBg: palette.tasks,
          iconColor: '#FFFFFF',
          actionBg: palette.mutedSurface,
          actionText: palette.text,
          sectionBg: palette.mutedSurface,
          itemBg: palette.card,
          itemBorder: palette.cardBorder,
          muted: palette.textMuted,
        },
        reminders: {
          card: palette.card,
          header: palette.mutedSurface,
          border: palette.cardBorder,
          accent: palette.health,
          iconBg: palette.health,
          iconColor: '#FFFFFF',
          actionBg: palette.mutedSurface,
          actionText: palette.text,
          itemBg: palette.mutedSurface,
          itemBorder: palette.cardBorder,
        },
        groceries: {
          card: palette.card,
          header: palette.mutedSurface,
          border: palette.cardBorder,
          accent: palette.finance,
          iconBg: palette.finance,
          iconColor: '#FFFFFF',
          actionBg: palette.mutedSurface,
          actionText: palette.text,
          itemBg: palette.mutedSurface,
          itemBorder: palette.cardBorder,
        },
      }),
      [palette]
    );
    const modalThemes = useMemo(
      () => {
        const routineTheme = sectionThemes.routine;
        return {
        reminder: {
          gradient: isDark ? ['#7C2D12', '#BE185D'] : ['#FB923C', '#F43F5E'],
          surface: isDark ? '#1B0B12' : '#FFFFFF',
          border: isDark ? 'rgba(236, 72, 153, 0.4)' : '#F9C6D9',
          fieldBg: isDark ? '#2A0E1B' : '#FFF5F2',
          fieldBorder: isDark ? 'rgba(236, 72, 153, 0.4)' : '#F6C1D4',
          headerText: '#FFFFFF',
          headerSubText: 'rgba(255, 255, 255, 0.85)',
          iconBg: 'rgba(255, 255, 255, 0.2)',
          closeBg: 'rgba(255, 255, 255, 0.22)',
          chipBg: isDark ? 'rgba(249, 115, 22, 0.2)' : '#FFE7D5',
          chipBorder: isDark ? 'rgba(249, 115, 22, 0.35)' : '#FFD5B5',
          chipText: isDark ? '#FDBA74' : '#C2410C',
          chipActiveBg: isDark ? '#F97316' : '#FB923C',
          chipActiveBorder: isDark ? '#FDBA74' : '#FB923C',
          chipActiveText: '#FFFFFF',
          actionGradient: isDark ? ['#F97316', '#EC4899'] : ['#FB923C', '#F472B6'],
          secondaryBg: isDark ? '#1F1419' : '#F3F4F6',
          secondaryBorder: isDark ? '#2D1B22' : '#E5E7EB',
          secondaryText: themeColors.text,
          accent: themeColors.health,
        },
        routine: {
          gradient: [routineTheme.header, routineTheme.card],
          surface: routineTheme.card,
          border: routineTheme.border,
          fieldBg: routineTheme.sectionBg,
          fieldBorder: routineTheme.itemBorder,
          headerText: themeColors.text,
          headerSubText: routineTheme.muted,
          iconBg: routineTheme.iconBg,
          closeBg: routineTheme.sectionBg,
          chipBg: routineTheme.sectionBg,
          chipBorder: routineTheme.itemBorder,
          chipText: routineTheme.muted,
          chipActiveBg: routineTheme.accent,
          chipActiveBorder: routineTheme.accent,
          chipActiveText: isDark ? '#1F1305' : '#FFFFFF',
          actionGradient: [routineTheme.iconBg, routineTheme.accent],
          secondaryBg: routineTheme.sectionBg,
          secondaryBorder: routineTheme.itemBorder,
          secondaryText: themeColors.text,
          accent: routineTheme.accent,
        },
      };
      },
      [isDark, themeColors, sectionThemes]
    );
    const routineModal = modalThemes.routine;
    const reminderModal = modalThemes.reminder;
    const styles = useMemo(() => createStyles(themeColors, palette), [themeColors, palette]);

    useEffect(() => {
      ensureRoutinesLoaded();
      ensureRemindersLoaded();
      ensureGroceriesLoaded();
    }, [ensureGroceriesLoaded, ensureRemindersLoaded, ensureRoutinesLoaded]);

  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showRoutineTimePicker, setShowRoutineTimePicker] = useState(false);
  const [routineTimePickerTarget, setRoutineTimePickerTarget] = useState(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showGroceryModal, setShowGroceryModal] = useState(false);

  const [routineName, setRoutineName] = useState('');
  const [routineCreateType, setRoutineCreateType] = useState('personal');
  const [routineGroupId, setRoutineGroupId] = useState(null);
  const [routineStartTime, setRoutineStartTime] = useState('');
  const [routineEndTime, setRoutineEndTime] = useState('');
  const [routineRepeat, setRoutineRepeat] = useState(ROUTINE_REPEAT.DAILY);
  const [routineWeekDays, setRoutineWeekDays] = useState([]);
  const [routineMonthDays, setRoutineMonthDays] = useState([]);
  const [reminderName, setReminderName] = useState('');
  const [reminderDescription, setReminderDescription] = useState('');
  const [reminderDate, setReminderDate] = useState(new Date().toISOString().split('T')[0]);
  const [reminderTime, setReminderTime] = useState('');
  const [showReminderDatePicker, setShowReminderDatePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [groceryItemInput, setGroceryItemInput] = useState('');
  const [groceryListNameInput, setGroceryListNameInput] = useState('');
  const [groceryListEmojiInput, setGroceryListEmojiInput] = useState(DEFAULT_GROCERY_EMOJI);
  const [groceryListDueDate, setGroceryListDueDate] = useState('');
  const [groceryListDueTime, setGroceryListDueTime] = useState('');
  const [groceryItemDueDate, setGroceryItemDueDate] = useState('');
  const [groceryItemDueTime, setGroceryItemDueTime] = useState('');
  const [showGroceryDatePicker, setShowGroceryDatePicker] = useState(false);
  const [showGroceryTimePicker, setShowGroceryTimePicker] = useState(false);
  const [groceryPickerTarget, setGroceryPickerTarget] = useState(null);
  const [activeGroceryListId, setActiveGroceryListId] = useState(null);
  const [groceryListEditorMode, setGroceryListEditorMode] = useState(null);
  const [isGroceryItemEditorOpen, setIsGroceryItemEditorOpen] = useState(false);
  const handledRoutineOpenRequestKeyRef = useRef(null);
  const grocerySceneAnim = useRef(new Animated.Value(1)).current;
  const pendingRoutineOpenKey = route?.params?.openRoutineFormKey || null;
  const pendingRoutineCreateType = route?.params?.routineCreateType || null;
  const pendingRoutineGroupId = route?.params?.groupId || null;
  const normalizedReminderTime = useMemo(
    () => normalizeTimeValue(reminderTime),
    [reminderTime]
  );

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const groupNameMap = useMemo(() => {
    const map = new Map();
    (groups || []).forEach((group) => {
      map.set(group.id, group.name);
    });
    return map;
  }, [groups]);

  useEffect(() => {
    if (!pendingRoutineOpenKey) return;
    if (handledRoutineOpenRequestKeyRef.current === pendingRoutineOpenKey) return;

    handledRoutineOpenRequestKeyRef.current = pendingRoutineOpenKey;
    setRoutineName('');
    setRoutineStartTime('');
    setRoutineEndTime('');
    setRoutineRepeat(ROUTINE_REPEAT.DAILY);
    setRoutineWeekDays([]);
    setRoutineMonthDays([]);
    setShowRoutineTimePicker(false);
    setRoutineTimePickerTarget(null);

    const targetType = pendingRoutineCreateType === 'group' ? 'group' : 'personal';
    setRoutineCreateType(targetType);
    if (targetType === 'group') {
      setRoutineGroupId(pendingRoutineGroupId || null);
    } else {
      setRoutineGroupId(null);
    }
    setShowRoutineModal(true);
  }, [pendingRoutineOpenKey, pendingRoutineCreateType, pendingRoutineGroupId]);

  const handleCreateRoutine = async () => {
    if (!routineName.trim()) return;
    if (!routineStartTime || !routineEndTime) return;
    const routineDays = getRoutineDaysForRepeat({
      repeat: routineRepeat,
      weekDays: routineWeekDays,
      monthDays: routineMonthDays,
    });
    if (!isRoutineScheduleValid(routineRepeat, routineDays)) {
      Alert.alert(
        'Select routine days',
        routineRepeat === ROUTINE_REPEAT.MONTHLY
          ? 'Choose at least one day of the month for this routine.'
          : 'Choose at least one weekday for this routine.'
      );
      return;
    }
    if (routineCreateType === 'group' && !routineGroupId) {
      Alert.alert('Select a group', 'Choose a group before creating a group routine.');
      return;
    }
    try {
      const payload = {
        name: routineName.trim(),
        startTime: routineStartTime,
        endTime: routineEndTime,
        repeat: normalizeRoutineRepeat(routineRepeat),
        days: routineDays,
      };
      if (routineCreateType === 'group') {
        await addGroupRoutine({ ...payload, groupId: routineGroupId });
      } else {
        await addRoutine(payload);
      }
      setRoutineName('');
      setRoutineCreateType('personal');
      setRoutineGroupId(null);
      setRoutineStartTime('');
      setRoutineEndTime('');
      setRoutineRepeat(ROUTINE_REPEAT.DAILY);
      setRoutineWeekDays([]);
      setRoutineMonthDays([]);
      setShowRoutineTimePicker(false);
      setRoutineTimePickerTarget(null);
      setShowRoutineModal(false);
    } catch (error) {
      Alert.alert('Unable to create routine', error?.message || 'Please try again.');
    }
  };

  const handleCreateReminder = async () => {
    if (!reminderName.trim()) return;
    await addReminder({
      title: reminderName.trim(),
      description: reminderDescription.trim(),
      date: reminderDate,
      time: reminderTime,
    });
    setReminderName('');
    setReminderDescription('');
    setReminderDate(new Date().toISOString().split('T')[0]);
    setReminderTime('');
    setShowReminderDatePicker(false);
    setShowReminderTimePicker(false);
    setShowReminderModal(false);
  };

  const closeRoutineModal = () => {
    setShowRoutineModal(false);
    setRoutineName('');
    setRoutineCreateType('personal');
    setRoutineGroupId(null);
    setRoutineStartTime('');
    setRoutineEndTime('');
    setRoutineRepeat(ROUTINE_REPEAT.DAILY);
    setRoutineWeekDays([]);
    setRoutineMonthDays([]);
    setShowRoutineTimePicker(false);
    setRoutineTimePickerTarget(null);
  };

  const openRoutineModal = (type = 'personal') => {
    const nextType = type === 'group' && groups.length > 0 ? 'group' : 'personal';
    setRoutineCreateType(nextType);
    if (nextType !== 'group') {
      setRoutineGroupId(null);
    }
    setRoutineRepeat(ROUTINE_REPEAT.DAILY);
    setRoutineWeekDays([]);
    setRoutineMonthDays([]);
    setShowRoutineModal(true);
  };

  const handleRoutineCreateTypeSelect = (value) => {
    setRoutineCreateType(value);
    if (value !== 'group') {
      setRoutineGroupId(null);
    }
  };

  const handleRoutineRepeatSelect = (value) => {
    setRoutineRepeat(normalizeRoutineRepeat(value));
  };

  const toggleRoutineWeekDay = (dayLabel) => {
    setRoutineWeekDays((prev) => {
      const next = prev.includes(dayLabel)
        ? prev.filter((value) => value !== dayLabel)
        : [...prev, dayLabel];
      return normalizeRoutineDays(next, ROUTINE_REPEAT.WEEKLY);
    });
  };

  const toggleRoutineMonthDay = (day) => {
    const dayLabel = String(day);
    setRoutineMonthDays((prev) => {
      const next = prev.map((value) => String(value));
      const updated = next.includes(dayLabel)
        ? next.filter((value) => value !== dayLabel)
        : [...next, dayLabel];
      return normalizeRoutineDays(updated, ROUTINE_REPEAT.MONTHLY).map((value) => Number(value));
    });
  };

  const closeReminderModal = () => {
    setShowReminderModal(false);
    setReminderName('');
    setReminderDescription('');
    setShowReminderDatePicker(false);
    setShowReminderTimePicker(false);
  };

  const handleQuickReminderTime = (value) => {
    setReminderTime(value);
    setShowReminderTimePicker(false);
  };

  const handleRoutineSuggestion = (label) => {
    setRoutineName(label);
  };

  const handleSelectRoutineTime = (value) => {
    const normalized =
      value instanceof Date ? formatTimeFromDate(value) : value;
    if (routineTimePickerTarget === 'start') {
      setRoutineStartTime(normalizeRoutineTimeValue(normalized));
    }
    if (routineTimePickerTarget === 'end') {
      setRoutineEndTime(normalizeRoutineTimeValue(normalized));
    }
    setShowRoutineTimePicker(false);
    setRoutineTimePickerTarget(null);
  };

  const openRoutineTimePicker = (target) => {
    setRoutineTimePickerTarget(target);
    setShowRoutineTimePicker(true);
  };

  const handleQuickRoutineTime = (value, target) => {
    const normalized = normalizeRoutineTimeValue(value);
    if (!normalized) return;
    if (target === 'start') {
      setRoutineStartTime(normalized);
      return;
    }
    if (target === 'end') {
      setRoutineEndTime(normalized);
    }
  };

  const animateGroceryScene = useCallback(() => {
    grocerySceneAnim.setValue(0);
    Animated.timing(grocerySceneAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [grocerySceneAnim]);

  const openGroceryListDetail = useCallback(
    (listId) => {
      if (!listId || listId === activeGroceryListId) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsGroceryItemEditorOpen(false);
      setGroceryItemInput('');
      setGroceryItemDueDate('');
      setGroceryItemDueTime('');
      setActiveGroceryListId(listId);
      animateGroceryScene();
    },
    [activeGroceryListId, animateGroceryScene]
  );

  const closeGroceryListDetail = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsGroceryItemEditorOpen(false);
    setGroceryItemInput('');
    setGroceryItemDueDate('');
    setGroceryItemDueTime('');
    setActiveGroceryListId(null);
    animateGroceryScene();
  }, [animateGroceryScene]);

  const openGroceryModal = (listId = null) => {
    setShowGroceryModal(true);
    setGroceryListEditorMode(null);
    setIsGroceryItemEditorOpen(false);
    if (listId) {
      setActiveGroceryListId(listId);
    } else {
      setActiveGroceryListId(null);
    }
    animateGroceryScene();
  };

  const closeGroceryModal = () => {
    setShowGroceryModal(false);
    setActiveGroceryListId(null);
    setGroceryListEditorMode(null);
    setIsGroceryItemEditorOpen(false);
    setGroceryItemInput('');
    setGroceryListNameInput('');
    setGroceryListEmojiInput(DEFAULT_GROCERY_EMOJI);
    setGroceryListDueDate('');
    setGroceryListDueTime('');
    setGroceryItemDueDate('');
    setGroceryItemDueTime('');
    setShowGroceryDatePicker(false);
    setShowGroceryTimePicker(false);
    setGroceryPickerTarget(null);
  };

  const openGroceryListCreator = () => {
    setGroceryListEditorMode('create');
    setGroceryListNameInput('');
    setGroceryListEmojiInput(DEFAULT_GROCERY_EMOJI);
    setGroceryListDueDate('');
    setGroceryListDueTime('');
    setShowGroceryDatePicker(false);
    setShowGroceryTimePicker(false);
    setGroceryPickerTarget(null);
    animateGroceryScene();
  };

  const openGroceryListEditor = () => {
    if (!selectedGroceryList?.id) return;
    setIsGroceryItemEditorOpen(false);
    setGroceryItemInput('');
    setGroceryItemDueDate('');
    setGroceryItemDueTime('');
    setGroceryListEditorMode('edit');
    setGroceryListNameInput(selectedGroceryList.name || '');
    setGroceryListEmojiInput(selectedGroceryList.emoji || DEFAULT_GROCERY_EMOJI);
    setGroceryListDueDate(selectedGroceryList.dueDate || '');
    setGroceryListDueTime(selectedGroceryList.dueTime || '');
    setShowGroceryDatePicker(false);
    setShowGroceryTimePicker(false);
    setGroceryPickerTarget(null);
    animateGroceryScene();
  };

  const closeGroceryListEditor = () => {
    setGroceryListEditorMode(null);
    setGroceryListNameInput('');
    setGroceryListEmojiInput(DEFAULT_GROCERY_EMOJI);
    setGroceryListDueDate('');
    setGroceryListDueTime('');
    setShowGroceryDatePicker(false);
    setShowGroceryTimePicker(false);
    setGroceryPickerTarget(null);
    animateGroceryScene();
  };

  const openGroceryItemCreator = () => {
    setIsGroceryItemEditorOpen(true);
    setGroceryItemInput('');
    setGroceryItemDueDate('');
    setGroceryItemDueTime('');
    setShowGroceryDatePicker(false);
    setShowGroceryTimePicker(false);
    setGroceryPickerTarget(null);
  };

  const closeGroceryItemCreator = () => {
    setIsGroceryItemEditorOpen(false);
    setGroceryItemInput('');
    setGroceryItemDueDate('');
    setGroceryItemDueTime('');
    if (groceryPickerTarget === 'item') {
      setShowGroceryDatePicker(false);
      setShowGroceryTimePicker(false);
      setGroceryPickerTarget(null);
    }
  };

  const handleSaveGroceryList = async () => {
    const listName = groceryListNameInput.trim();
    if (!listName) return;

    const payload = {
      dueDate: groceryListDueDate || null,
      dueTime: groceryListDueTime || null,
    };

    try {
      if (groceryListEditorMode === 'edit' && selectedGroceryList?.id) {
        const updated = await updateGroceryList(selectedGroceryList.id, {
          name: listName,
          emoji: groceryListEmojiInput.trim() || DEFAULT_GROCERY_EMOJI,
          ...payload,
        });
        if (updated?.id) {
          setActiveGroceryListId(updated.id);
        }
      } else {
        const created = await addGroceryList(
          listName,
          groceryListEmojiInput.trim() || DEFAULT_GROCERY_EMOJI,
          payload
        );
        if (created?.id) {
          setActiveGroceryListId(created.id);
        }
      }

      setGroceryListEditorMode(null);
      setGroceryListNameInput('');
      setGroceryListEmojiInput(DEFAULT_GROCERY_EMOJI);
      setGroceryListDueDate('');
      setGroceryListDueTime('');
      animateGroceryScene();
    } catch (error) {
      Alert.alert(
        groceryListEditorMode === 'edit' ? 'Unable to update list' : 'Unable to create list',
        error?.message || 'Please try again.'
      );
    }
  };

  const handleCreateQuickList = async (template) => {
    const normalizedName = template?.name?.trim()?.toLowerCase();
    if (!normalizedName) return;

    const existing = (groceryListSummaries || []).find(
      (list) => String(list?.name || '').trim().toLowerCase() === normalizedName
    );
    if (existing?.id) {
      openGroceryListDetail(existing.id);
      return;
    }

    try {
      const created = await addGroceryList(template.name, template.emoji || DEFAULT_GROCERY_EMOJI);
      if (created?.id) {
        openGroceryListDetail(created.id);
      }
    } catch (error) {
      Alert.alert('Unable to create list', error?.message || 'Please try again.');
    }
  };

  const handleAddGroceryItem = async () => {
    const itemName = groceryItemInput.trim();
    if (!itemName) return;

    const targetListId = activeGroceryListId || groceryLists[0]?.id;
    if (!targetListId) {
      Alert.alert('Create a list first', 'Add a list before adding items.');
      return;
    }

    try {
      await addGroceryItem(itemName, targetListId, {
        dueDate: groceryItemDueDate || null,
        dueTime: groceryItemDueTime || null,
      });
      closeGroceryItemCreator();
    } catch (error) {
      Alert.alert('Unable to add item', error?.message || 'Please try again.');
    }
  };

  const handleDeleteActiveGroceryList = async () => {
    if (!activeGroceryListId) return;

    Alert.alert('Delete list?', 'This removes the list and all of its items.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGroceryList(activeGroceryListId);
            closeGroceryListDetail();
          } catch (error) {
            Alert.alert('Unable to delete list', error?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const openRoutineDetail = (routineId, isGroup) => {
    navigation.navigate('RoutineDetail', { routineId, isGroup });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'No date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatISODate = (date) => date.toISOString().split('T')[0];

  const formatDueSummary = (dateValue, timeValue, emptyLabel = 'No date or time') => {
    if (!dateValue && !timeValue) return emptyLabel;
    const datePart = dateValue ? formatDate(dateValue) : null;
    const timePart = timeValue || null;
    if (datePart && timePart) return `${datePart} at ${timePart}`;
    return datePart || timePart || emptyLabel;
  };

  const reminderTimeOptions = REMINDER_TIME_OPTIONS;

  const openReminderDatePicker = () => {
    setShowReminderTimePicker(false);
    setShowReminderDatePicker(true);
  };

  const handleSelectReminderDate = (date) => {
    setReminderDate(formatISODate(date));
  };

  const openReminderTimePicker = () => {
    setShowReminderDatePicker(false);
    setShowReminderTimePicker(true);
  };

  const openGroceryDatePicker = (target) => {
    setGroceryPickerTarget(target);
    setShowGroceryTimePicker(false);
    setShowGroceryDatePicker(true);
  };

  const handleSelectGroceryDate = (date) => {
    const isoDate = formatISODate(date);
    if (groceryPickerTarget === 'list') {
      setGroceryListDueDate(isoDate);
    } else if (groceryPickerTarget === 'item') {
      setGroceryItemDueDate(isoDate);
    }
    setShowGroceryDatePicker(false);
    setGroceryPickerTarget(null);
  };

  const openGroceryTimePicker = (target) => {
    setGroceryPickerTarget(target);
    setShowGroceryDatePicker(false);
    setShowGroceryTimePicker(true);
  };

  const handleSelectGroceryTime = (value) => {
    const normalized =
      value instanceof Date ? formatTimeFromDate(value) : value;
    if (groceryPickerTarget === 'list') {
      setGroceryListDueTime(normalized);
    } else if (groceryPickerTarget === 'item') {
      setGroceryItemDueTime(normalized);
    }
    setShowGroceryTimePicker(false);
    setGroceryPickerTarget(null);
  };

  const clearGroceryListDue = () => {
    setGroceryListDueDate('');
    setGroceryListDueTime('');
  };

  const clearGroceryItemDue = () => {
    setGroceryItemDueDate('');
    setGroceryItemDueTime('');
  };

  const handleSelectReminderTime = (value) => {
    const normalized =
      value instanceof Date ? formatTimeFromDate(value) : value;
    setReminderTime(normalized);
  };

  useEffect(() => {
    if (!activeGroceryListId) return;
    const exists = (groceryLists || []).some((list) => list.id === activeGroceryListId);
    if (!exists) {
      closeGroceryListDetail();
    }
  }, [activeGroceryListId, groceryLists, closeGroceryListDetail]);

  const groceryListSummaries = useMemo(() => {
    const fallbackListId = groceryLists[0]?.id || null;
    return (groceryLists || []).map((list) => {
      const items = (groceries || []).filter(
        (item) => (item.listId || fallbackListId) === list.id
      );
      const completedCount = items.filter((item) => item.completed).length;
      return {
        ...list,
        itemCount: items.length,
        completedCount,
        activeCount: items.length - completedCount,
      };
    });
  }, [groceryLists, groceries]);

  const selectedGroceryList = useMemo(
    () =>
      groceryListSummaries.find((list) => list.id === activeGroceryListId) || null,
    [activeGroceryListId, groceryListSummaries]
  );
  const isGroceryListEditorOpen =
    groceryListEditorMode === 'create' || groceryListEditorMode === 'edit';
  const isEditingActiveGroceryList = groceryListEditorMode === 'edit';
  const canModifySelectedGroceryList = !!selectedGroceryList;
  const isGroceryRootScreen = !selectedGroceryList && !isGroceryListEditorOpen;

  const selectedGroceryItems = useMemo(() => {
    if (!selectedGroceryList?.id) return [];
    const fallbackListId = groceryLists[0]?.id || selectedGroceryList.id;
    return (groceries || []).filter(
      (item) => (item.listId || fallbackListId) === selectedGroceryList.id
    );
  }, [groceries, groceryLists, selectedGroceryList]);

  const activeGroceries = useMemo(
    () => selectedGroceryItems.filter((item) => !item.completed),
    [selectedGroceryItems]
  );
  const completedGroceries = useMemo(
    () => selectedGroceryItems.filter((item) => item.completed),
    [selectedGroceryItems]
  );
  const totalGroceryLists = groceryListSummaries.length;
  const totalGroceryItems = groceries.length;
  const totalOpenGroceryItems = groceries.filter((item) => !item.completed).length;
  const totalRoutineCount = routines.length + groupRoutines.length;
  const reminderCount = reminders.length;
  const isGroupRoutineCreate = routineCreateType === 'group';
  const routineSelectedDays = getRoutineDaysForRepeat({
    repeat: routineRepeat,
    weekDays: routineWeekDays,
    monthDays: routineMonthDays,
  });
  const isRoutineScheduleSelectionValid = isRoutineScheduleValid(
    routineRepeat,
    routineSelectedDays
  );
  const routineCreateDisabled =
    !routineName.trim() ||
    !routineStartTime ||
    !routineEndTime ||
    !isRoutineScheduleSelectionValid ||
    (isGroupRoutineCreate && !routineGroupId);

  const renderActiveGroceryList = () => (
    <>
      {selectedGroceryItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.groceryEmptyEmoji}>
            {selectedGroceryList?.emoji || DEFAULT_GROCERY_EMOJI}
          </Text>
          <Text style={styles.emptyText}>No items in this list yet</Text>
        </View>
      ) : (
        <>
          {activeGroceries.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.groceryItem,
                {
                  backgroundColor: groceriesTheme.itemBg,
                  borderColor: groceriesTheme.itemBorder,
                },
              ]}
              onPress={() => toggleGroceryItem(item.id)}
            >
              <View
                style={[
                  styles.groceryCheckbox,
                  { borderColor: groceriesTheme.itemBorder },
                ]}
              />
              <View style={styles.groceryItemContent}>
                <Text style={styles.groceryText}>{item.name}</Text>
                {(item.dueDate || item.dueTime) ? (
                  <Text style={styles.groceryItemDueText}>
                    {formatDueSummary(item.dueDate, item.dueTime, '')}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => deleteGroceryItem(item.id)}>
                <Ionicons name="close" size={16} color={themeColors.textLight} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {completedGroceries.length > 0 && (
            <>
              <View style={styles.completedHeader}>
                <Text style={styles.completedLabel}>Completed</Text>
                <TouchableOpacity onPress={() => clearCompletedGroceries(selectedGroceryList?.id)}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>
              {completedGroceries.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.groceryItem,
                    {
                      backgroundColor: groceriesTheme.itemBg,
                      borderColor: groceriesTheme.itemBorder,
                    },
                  ]}
                  onPress={() => toggleGroceryItem(item.id)}
                >
                  <View
                    style={[
                      styles.groceryCheckbox,
                      styles.groceryCheckboxChecked,
                      { borderColor: groceriesTheme.itemBorder },
                    ]}
                  >
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                  <View style={styles.groceryItemContent}>
                    <Text style={[styles.groceryText, styles.groceryTextCompleted]}>
                      {item.name}
                    </Text>
                    {(item.dueDate || item.dueTime) ? (
                      <Text style={[styles.groceryItemDueText, styles.groceryItemDueTextCompleted]}>
                        {formatDueSummary(item.dueDate, item.dueTime, '')}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </>
      )}
    </>
  );

  const routineTheme = sectionThemes.routine;
  const groupTheme = sectionThemes.group;
  const remindersTheme = sectionThemes.reminders;
  const groceriesTheme = sectionThemes.groceries;

  return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
        <PlatformScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          alwaysBounceVertical
          bounces
        >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.pageTitle, { color: palette.text }]}>Routine Hub</Text>
            <Text style={[styles.pageSubtitle, { color: palette.textMuted }]}>
              Manage routines, lists, and reminders
            </Text>
          </View>
          <View style={styles.headerAddWrap}>
            <TouchableOpacity
              style={[styles.headerAddButton, { backgroundColor: palette.routine }]}
              onPress={() => openRoutineModal('personal')}
              activeOpacity={0.9}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Card style={[styles.statCard, styles.statRoutine]}>
            <Ionicons name="sunny" size={16} color={palette.routine} />
            <Text style={styles.statLabel}>Routines</Text>
            <Text style={styles.statValue}>{totalRoutineCount}</Text>
          </Card>
          <Card style={[styles.statCard, styles.statTasks]}>
            <Ionicons name="list" size={16} color={palette.info} />
            <Text style={styles.statLabel}>Open list items</Text>
            <Text style={styles.statValue}>{totalOpenGroceryItems}</Text>
          </Card>
          <Card style={[styles.statCard, styles.statReminders]}>
            <Ionicons name="notifications" size={16} color={palette.health} />
            <Text style={styles.statLabel}>Reminders</Text>
            <Text style={styles.statValue}>{reminderCount}</Text>
          </Card>
        </View>

        {/* Routine Manager Section */}
        <Card
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.cardBorder },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: routineTheme.iconBg },
                ]}
              >
                <Ionicons name="sunny" size={18} color={routineTheme.iconColor} />
              </View>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                Routine Manager
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.sectionAction,
                { backgroundColor: routineTheme.actionBg },
              ]}
              onPress={() => openRoutineModal('personal')}
            >
              <Ionicons name="add" size={16} color={routineTheme.actionText} />
              <Text style={[styles.sectionActionText, { color: routineTheme.actionText }]}>
                Create
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionBody}>
            {routines.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="clipboard-list-outline"
                  size={40}
                  color={routineTheme.accent}
                />
                <Text style={styles.emptyText}>No routines yet</Text>
              </View>
            ) : (
              routines.map((routine) => {
                const taskCount = routine.tasks?.length || 0;
                const scheduleSummary = formatRoutineScheduleSummary(routine);
                return (
                  <TouchableOpacity
                    key={routine.id}
                    style={[
                      styles.routineSection,
                      {
                        backgroundColor: routineTheme.sectionBg,
                        borderColor: routineTheme.itemBorder,
                      },
                    ]}
                    onPress={() => openRoutineDetail(routine.id, false)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.routineHeader}>
                      <View style={styles.routineTitleRow}>
                        <View
                          style={[
                            styles.routineBadge,
                            {
                              borderColor: routineTheme.itemBorder,
                              backgroundColor: routineTheme.itemBg,
                            },
                          ]}
                        >
                          <Ionicons
                            name="sparkles"
                            size={12}
                            color={routineTheme.accent}
                          />
                        </View>
                        <Text style={[styles.routineName, { color: routineTheme.accent }]}>
                          {routine.name}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={routineTheme.accent} />
                    </View>
                    <Text style={[styles.routineMeta, { color: routineTheme.muted }]}>
                      {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                    </Text>
                    <Text style={[styles.routineMeta, { color: routineTheme.muted }]}>
                      {scheduleSummary}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </Card>

        {(groupRoutines.length > 0 || groups.length > 0) ? (
          <Card
            style={[
              styles.sectionCard,
              { backgroundColor: palette.card, borderColor: palette.cardBorder },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIcon, { backgroundColor: groupTheme.iconBg }]}>
                  <Ionicons name="people" size={18} color={groupTheme.iconColor} />
                </View>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  Group Routines
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.sectionAction, { backgroundColor: groupTheme.actionBg }]}
                onPress={() => openRoutineModal('group')}
              >
                <Ionicons name="add" size={16} color={groupTheme.actionText} />
                <Text style={[styles.sectionActionText, { color: groupTheme.actionText }]}>
                  Create
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionBody}>
              {groupRoutines.length === 0 ? (
                <Text style={styles.emptyText}>No group routines yet</Text>
              ) : (
                groupRoutines.map((routine) => {
                  const taskCount = routine.tasks?.length || 0;
                  const groupName = groupNameMap.get(routine.groupId) || 'Group';
                  const scheduleSummary = formatRoutineScheduleSummary(routine);
                  return (
                    <TouchableOpacity
                      key={routine.id}
                      style={[
                        styles.routineSection,
                        {
                          backgroundColor: groupTheme.sectionBg,
                          borderColor: groupTheme.itemBorder,
                        },
                      ]}
                      onPress={() => openRoutineDetail(routine.id, true)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.routineHeader}>
                        <View>
                          <Text style={[styles.routineName, { color: groupTheme.accent }]}>
                            {routine.name}
                          </Text>
                          <Text style={[styles.routineMeta, { color: groupTheme.muted }]}>
                            {groupName} - {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                          </Text>
                          <Text style={[styles.routineMeta, { color: groupTheme.muted }]}>
                            {scheduleSummary}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={groupTheme.accent} />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </Card>
        ) : null}

        {/* Lists Section */}
        <Card
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.cardBorder },
          ]}
          onPress={() => openGroceryModal()}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: groceriesTheme.iconBg }]}>
                <Ionicons name="list" size={18} color={groceriesTheme.iconColor} />
              </View>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Lists</Text>
            </View>
            <TouchableOpacity
              style={[styles.sectionAction, { backgroundColor: groceriesTheme.actionBg }]}
              onPress={() => openGroceryModal()}
            >
              <Ionicons name="add" size={16} color={groceriesTheme.actionText} />
              <Text style={[styles.sectionActionText, { color: groceriesTheme.actionText }]}>
                Create
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionBody}>
            <Text style={styles.groceryOverviewMeta}>
              {totalGroceryLists} list{totalGroceryLists === 1 ? '' : 's'} | {totalOpenGroceryItems} open |{' '}
              {totalGroceryItems} total item{totalGroceryItems === 1 ? '' : 's'}
            </Text>
            {groceryListSummaries.length === 0 ? (
              <Text style={styles.emptyText}>Create your first list</Text>
            ) : (
              <View style={styles.groceryListPreviewStack}>
                {groceryListSummaries.slice(0, 3).map((list) => (
                  <TouchableOpacity
                    key={list.id}
                    style={[
                      styles.groceryListPreviewCard,
                      {
                        backgroundColor: groceriesTheme.itemBg,
                        borderColor: groceriesTheme.itemBorder,
                      },
                    ]}
                    onPress={() => openGroceryModal(list.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.groceryListPreviewEmoji}>
                      {list.emoji || DEFAULT_GROCERY_EMOJI}
                    </Text>
                    <View style={styles.groceryListPreviewContent}>
                      <Text style={styles.groceryListPreviewTitle}>{list.name}</Text>
                      <Text style={styles.groceryListPreviewMeta}>
                        {list.activeCount} open | {list.completedCount} done
                      </Text>
                      {(list.dueDate || list.dueTime) ? (
                        <Text style={styles.groceryDueMeta}>
                          {formatDueSummary(list.dueDate, list.dueTime, '')}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={themeColors.textLight} />
                  </TouchableOpacity>
                ))}
                {groceryListSummaries.length > 3 && (
                  <Text style={styles.groceryMoreListsText}>
                    +{groceryListSummaries.length - 3} more list{groceryListSummaries.length - 3 === 1 ? '' : 's'}
                  </Text>
                )}
              </View>
            )}
          </View>
        </Card>

        {/* Reminders Section */}
        <Card
          style={[
            styles.sectionCard,
            styles.lastCard,
            { backgroundColor: palette.card, borderColor: palette.cardBorder },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: remindersTheme.iconBg }]}>
                <Ionicons name="notifications" size={18} color={remindersTheme.iconColor} />
              </View>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Reminders</Text>
            </View>
            <TouchableOpacity
              style={[styles.sectionAction, { backgroundColor: remindersTheme.actionBg }]}
              onPress={() => setShowReminderModal(true)}
            >
              <Ionicons name="add" size={16} color={remindersTheme.actionText} />
              <Text style={[styles.sectionActionText, { color: remindersTheme.actionText }]}>
                Add
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionBody}>
            {reminders.length === 0 ? (
              <Text style={styles.emptyText}>No reminders set</Text>
            ) : (
              reminders.map((reminder) => (
                <View
                  key={reminder.id}
                  style={[
                    styles.reminderItem,
                    {
                      backgroundColor: remindersTheme.itemBg,
                      borderColor: remindersTheme.itemBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.reminderIconBadge,
                      { backgroundColor: remindersTheme.iconBg },
                    ]}
                  >
                    <Ionicons
                      name="notifications"
                      size={16}
                      color={remindersTheme.iconColor}
                    />
                  </View>
                  <View style={styles.reminderContent}>
                    <Text style={styles.reminderTitle}>{reminder.title}</Text>
                    {reminder.description && (
                      <Text style={styles.reminderDescription} numberOfLines={1}>
                        {reminder.description}
                      </Text>
                    )}
                    <Text style={styles.reminderDate}>
                      {formatDate(reminder.date)}
                      {reminder.time && ` at ${reminder.time}`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteReminder(reminder.id)}>
                    <Ionicons name="close" size={18} color={themeColors.textLight} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </Card>

        </PlatformScrollView>

        {/* Create Routine Modal */}
        <Modal
          visible={showRoutineModal}
          onClose={closeRoutineModal}
          title="Create Routine"
          fullScreen
          hideHeader
          showCloseButton={false}
          contentStyle={{ paddingHorizontal: 0 }}
        >
          <View
            style={[
              styles.createRoutineScreen,
              { backgroundColor: palette.background, paddingTop: insets.top + spacing.sm },
            ]}
          >
            <View style={styles.createRoutineTop}>
              <TouchableOpacity
                style={[
                  styles.createRoutineTopButton,
                  { borderColor: palette.cardBorder, backgroundColor: palette.card },
                ]}
                onPress={closeRoutineModal}
              >
                <Ionicons name="chevron-back" size={20} color={palette.text} />
              </TouchableOpacity>
              <Text style={[styles.createRoutineTitle, { color: palette.text }]}>New Routine</Text>
              <View style={styles.createRoutineTopSpacer} />
            </View>

            <View style={styles.createRoutineBody}>
              <View
                style={[
                  styles.createRoutineSectionCard,
                  { borderColor: palette.cardBorder, backgroundColor: palette.card },
                ]}
              >
                <Input
                  label="Routine Name"
                  value={routineName}
                  onChangeText={setRoutineName}
                  placeholder="e.g., Morning Routine"
                  containerStyle={styles.modalInputContainer}
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: palette.mutedSurface,
                      borderColor: palette.cardBorder,
                    },
                  ]}
                  inputStyle={[styles.modalInputText, { color: palette.text }]}
                />
                <Text style={styles.quickLabel}>Quick suggestions</Text>
                <View style={styles.quickGroup}>
                  {ROUTINE_SUGGESTIONS.map((label) => {
                    const selected = routineName.trim() === label;
                    return (
                      <TouchableOpacity
                        key={label}
                        style={[
                          styles.quickChip,
                          {
                            backgroundColor: selected ? palette.routine : palette.mutedSurface,
                            borderColor: selected ? palette.routine : palette.cardBorder,
                          },
                        ]}
                        onPress={() => handleRoutineSuggestion(label)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            { color: selected ? '#FFFFFF' : palette.textMuted },
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View
                style={[
                  styles.createRoutineSectionCard,
                  { borderColor: palette.cardBorder, backgroundColor: palette.card },
                ]}
              >
                <Text style={styles.inputLabel}>Routine days</Text>
                <Text style={styles.scheduleHint}>
                  Choose whether this routine runs daily, on specific weekdays, or on specific month days.
                </Text>
                <ChipGroup
                  options={ROUTINE_REPEAT_OPTIONS}
                  selectedValue={routineRepeat}
                  onSelect={handleRoutineRepeatSelect}
                  style={styles.chipGroup}
                  color={palette.routine}
                />

                {routineRepeat === ROUTINE_REPEAT.WEEKLY ? (
                  <>
                    <Text style={styles.quickLabel}>Weekdays</Text>
                    <View style={styles.quickGroup}>
                      {ROUTINE_WEEKDAY_LABELS.map((dayLabel) => {
                        const selected = routineWeekDays.includes(dayLabel);
                        return (
                          <TouchableOpacity
                            key={`weekday-${dayLabel}`}
                            style={[
                              styles.quickChip,
                              {
                                backgroundColor: selected ? palette.routine : palette.mutedSurface,
                                borderColor: selected ? palette.routine : palette.cardBorder,
                              },
                            ]}
                            onPress={() => toggleRoutineWeekDay(dayLabel)}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.quickChipText,
                                { color: selected ? '#FFFFFF' : palette.textMuted },
                              ]}
                            >
                              {dayLabel}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                {routineRepeat === ROUTINE_REPEAT.MONTHLY ? (
                  <>
                    <Text style={styles.quickLabel}>Days of month</Text>
                    <View style={styles.quickGroup}>
                      {ROUTINE_MONTH_DAY_OPTIONS.map((day) => {
                        const dayLabel = String(day);
                        const selected = routineMonthDays
                          .map((value) => String(value))
                          .includes(dayLabel);
                        return (
                          <TouchableOpacity
                            key={`month-day-${day}`}
                            style={[
                              styles.quickChip,
                              {
                                backgroundColor: selected ? palette.routine : palette.mutedSurface,
                                borderColor: selected ? palette.routine : palette.cardBorder,
                              },
                            ]}
                            onPress={() => toggleRoutineMonthDay(day)}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.quickChipText,
                                { color: selected ? '#FFFFFF' : palette.textMuted },
                              ]}
                            >
                              {day}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                {!isRoutineScheduleSelectionValid ? (
                  <Text style={styles.scheduleValidationHint}>
                    {routineRepeat === ROUTINE_REPEAT.MONTHLY
                      ? 'Select at least one day of the month.'
                      : 'Select at least one weekday.'}
                  </Text>
                ) : null}
              </View>

              <View
                style={[
                  styles.createRoutineSectionCard,
                  { borderColor: palette.cardBorder, backgroundColor: palette.card },
                ]}
              >
                <Text style={styles.inputLabel}>Routine time range</Text>
                <Text style={styles.scheduleHint}>
                  Set when this routine starts and ends.
                </Text>
                <View style={styles.routineRangeRow}>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      styles.routineRangeButton,
                      {
                        backgroundColor: palette.mutedSurface,
                        borderColor: palette.cardBorder,
                      },
                    ]}
                    onPress={() => openRoutineTimePicker('start')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.dateButtonText, !routineStartTime && styles.placeholderText]}>
                      {routineStartTime || 'Start time'}
                    </Text>
                    <Ionicons name="time-outline" size={18} color={themeColors.textLight} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      styles.routineRangeButton,
                      { marginRight: 0 },
                      {
                        backgroundColor: palette.mutedSurface,
                        borderColor: palette.cardBorder,
                      },
                    ]}
                    onPress={() => openRoutineTimePicker('end')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.dateButtonText, !routineEndTime && styles.placeholderText]}>
                      {routineEndTime || 'End time'}
                    </Text>
                    <Ionicons name="time-outline" size={18} color={themeColors.textLight} />
                  </TouchableOpacity>
                </View>
                {routineStartTime && routineEndTime ? (
                  <Text style={styles.rangePreview}>
                    {formatRoutineScheduleSummary({
                      startTime: routineStartTime,
                      endTime: routineEndTime,
                      repeat: routineRepeat,
                      days: routineSelectedDays,
                    })}
                  </Text>
                ) : null}
                <Text style={styles.quickLabel}>Quick start times</Text>
                <View style={styles.quickGroup}>
                  {REMINDER_QUICK_TIMES.map((time) => {
                    const normalizedQuickTime = normalizeRoutineTimeValue(time);
                    const selected = routineStartTime === normalizedQuickTime;
                    return (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.quickChip,
                          {
                            backgroundColor: selected ? palette.routine : palette.mutedSurface,
                            borderColor: selected ? palette.routine : palette.cardBorder,
                          },
                        ]}
                        onPress={() => handleQuickRoutineTime(normalizedQuickTime, 'start')}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            { color: selected ? '#FFFFFF' : palette.textMuted },
                          ]}
                        >
                          {normalizedQuickTime}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.quickLabel}>Quick end times</Text>
                <View style={styles.quickGroup}>
                  {REMINDER_QUICK_TIMES.map((time) => {
                    const normalizedQuickTime = normalizeRoutineTimeValue(time);
                    const selected = routineEndTime === normalizedQuickTime;
                    return (
                      <TouchableOpacity
                        key={`end-${time}`}
                        style={[
                          styles.quickChip,
                          {
                            backgroundColor: selected ? palette.routine : palette.mutedSurface,
                            borderColor: selected ? palette.routine : palette.cardBorder,
                          },
                        ]}
                        onPress={() => handleQuickRoutineTime(normalizedQuickTime, 'end')}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            { color: selected ? '#FFFFFF' : palette.textMuted },
                          ]}
                        >
                          {normalizedQuickTime}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {groups.length > 0 ? (
                <View
                  style={[
                    styles.createRoutineSectionCard,
                    { borderColor: palette.cardBorder, backgroundColor: palette.card },
                  ]}
                >
                  <Text style={styles.inputLabel}>Routine type</Text>
                  <ChipGroup
                    options={ROUTINE_CREATE_TYPES}
                    selectedValue={routineCreateType}
                    onSelect={handleRoutineCreateTypeSelect}
                    style={styles.chipGroup}
                    color={palette.routine}
                  />
                  {isGroupRoutineCreate ? (
                    <>
                      <Text style={styles.inputLabel}>Group selection</Text>
                      <ChipGroup
                        options={groups.map((g) => ({ label: g.name, value: g.id }))}
                        selectedValue={routineGroupId}
                        onSelect={setRoutineGroupId}
                        style={styles.chipGroup}
                        color={palette.routine}
                      />
                      {!routineGroupId ? (
                        <Text style={styles.scheduleHint}>
                          Select a group to create this as a group routine.
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                </View>
              ) : null}

              <View
                style={[
                  styles.createRoutineSectionCard,
                  { borderColor: palette.cardBorder, backgroundColor: palette.card },
                ]}
              >
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.primaryButton,
                      { backgroundColor: palette.routine },
                      routineCreateDisabled && styles.primaryButtonDisabled,
                    ]}
                    onPress={handleCreateRoutine}
                    disabled={routineCreateDisabled}
                    activeOpacity={0.85}
                  >
                    <View style={styles.primaryButtonInner}>
                      <Text style={styles.primaryButtonText}>Create Routine</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          <PlatformTimePicker
            visible={showRoutineTimePicker}
            value={routineTimePickerTarget === 'end' ? routineEndTime : routineStartTime}
            onChange={handleSelectRoutineTime}
            onClose={() => {
              setShowRoutineTimePicker(false);
              setRoutineTimePickerTarget(null);
            }}
            accentColor={routineModal.accent}
          />
        </Modal>

      {/* Grocery Fullscreen Modal */}
      <Modal
        visible={showGroceryModal}
        onClose={closeGroceryModal}
        title="Lists"
        fullScreen
        hideHeader
        showCloseButton={false}
        contentStyle={{ paddingHorizontal: 0 }}
      >
        <View
          style={[
            styles.createRoutineScreen,
            { backgroundColor: palette.background, paddingTop: insets.top + spacing.sm },
          ]}
        >
          <View style={styles.createRoutineTop}>
            <TouchableOpacity
              style={[
                styles.createRoutineTopButton,
                { borderColor: palette.cardBorder, backgroundColor: palette.card },
              ]}
              onPress={
                isGroceryRootScreen
                  ? closeGroceryModal
                  : isGroceryListEditorOpen
                  ? closeGroceryListEditor
                  : selectedGroceryList
                  ? closeGroceryListDetail
                  : closeGroceryModal
              }
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={palette.text}
              />
            </TouchableOpacity>
            <Text style={[styles.createRoutineTitle, { color: palette.text }]}>
              {isGroceryListEditorOpen
                ? isEditingActiveGroceryList
                  ? 'Edit List'
                  : 'Create List'
                : selectedGroceryList
                ? selectedGroceryList.name
                : 'Lists'}
            </Text>
            {isGroceryRootScreen ? (
              <TouchableOpacity
                style={[
                  styles.createRoutineTopButton,
                  { borderColor: palette.cardBorder, backgroundColor: palette.card },
                ]}
                onPress={openGroceryListCreator}
              >
                <Ionicons name="add" size={20} color={palette.text} />
              </TouchableOpacity>
            ) : selectedGroceryList && !isGroceryListEditorOpen && canModifySelectedGroceryList ? (
              <View style={styles.groceryTopActions}>
                <TouchableOpacity
                  style={[
                    styles.createRoutineTopButton,
                    { borderColor: palette.cardBorder, backgroundColor: palette.card },
                  ]}
                  onPress={openGroceryListEditor}
                >
                  <Ionicons name="create-outline" size={17} color={palette.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.createRoutineTopButton,
                    { borderColor: palette.cardBorder, backgroundColor: palette.card, marginLeft: spacing.xs },
                  ]}
                  onPress={handleDeleteActiveGroceryList}
                >
                  <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.createRoutineTopSpacer} />
            )}
          </View>

          <Animated.View
            style={[
              styles.grocerySceneContainer,
              {
                opacity: grocerySceneAnim,
                transform: [
                  {
                    translateY: grocerySceneAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                  {
                    scale: grocerySceneAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.985, 1],
                    }),
                  },
                ],
              },
            ]}
          >
          {isGroceryListEditorOpen ? (
            <View style={styles.createRoutineBody}>
              <View
                style={[
                  styles.createRoutineSectionCard,
                  { borderColor: groceriesTheme.itemBorder, backgroundColor: palette.card },
                ]}
              >
                <Text style={styles.inputLabel}>List details</Text>
                <View style={styles.groceryListCreateRow}>
                  <TextInput
                    style={[
                      styles.groceryEmojiInput,
                      {
                        backgroundColor: groceriesTheme.itemBg,
                        borderColor: groceriesTheme.itemBorder,
                        color: themeColors.text,
                      },
                    ]}
                    value={groceryListEmojiInput}
                    onChangeText={setGroceryListEmojiInput}
                    placeholder={DEFAULT_GROCERY_EMOJI}
                    placeholderTextColor={themeColors.placeholder}
                    maxLength={2}
                  />
                  <TextInput
                    style={[
                      styles.groceryInput,
                      {
                        backgroundColor: groceriesTheme.itemBg,
                        borderColor: groceriesTheme.itemBorder,
                        color: themeColors.text,
                      },
                    ]}
                    value={groceryListNameInput}
                    onChangeText={setGroceryListNameInput}
                    placeholder="List name"
                    placeholderTextColor={themeColors.placeholder}
                    onSubmitEditing={handleSaveGroceryList}
                    returnKeyType="done"
                    autoFocus
                  />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.groceryEmojiScroll}
                >
                  {GROCERY_EMOJI_OPTIONS.map((emoji) => {
                    const selected = groceryListEmojiInput === emoji;
                    return (
                      <TouchableOpacity
                        key={emoji}
                        style={[
                          styles.groceryEmojiChip,
                          selected && {
                            borderColor: groceriesTheme.accent,
                            backgroundColor: groceriesTheme.itemBg,
                          },
                        ]}
                        onPress={() => setGroceryListEmojiInput(emoji)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.groceryEmojiChipText}>{emoji}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.dateTimeRow}>
                  <View style={styles.dateInput}>
                    <Text style={styles.inputLabel}>List Date</Text>
                    <TouchableOpacity
                      style={[
                        styles.dateButton,
                        {
                          backgroundColor: groceriesTheme.itemBg,
                          borderColor: groceriesTheme.itemBorder,
                        },
                      ]}
                      onPress={() => openGroceryDatePicker('list')}
                    >
                      <Text style={[styles.dateButtonText, !groceryListDueDate && styles.placeholderText]}>
                        {groceryListDueDate ? formatDate(groceryListDueDate) : 'Choose date'}
                      </Text>
                      <Ionicons name="calendar-outline" size={18} color={themeColors.textLight} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.timeInput}>
                    <Text style={styles.inputLabel}>List Time</Text>
                    <TouchableOpacity
                      style={[
                        styles.dateButton,
                        {
                          backgroundColor: groceriesTheme.itemBg,
                          borderColor: groceriesTheme.itemBorder,
                        },
                      ]}
                      onPress={() => openGroceryTimePicker('list')}
                    >
                      <Text style={[styles.dateButtonText, !groceryListDueTime && styles.placeholderText]}>
                        {groceryListDueTime || '--:--'}
                      </Text>
                      <Ionicons name="time-outline" size={18} color={themeColors.textLight} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.groceryDueActions}>
                  <Text style={styles.groceryDueMeta}>
                    {formatDueSummary(groceryListDueDate, groceryListDueTime, 'No due date or time set')}
                  </Text>
                  {(groceryListDueDate || groceryListDueTime) ? (
                    <TouchableOpacity onPress={clearGroceryListDue} activeOpacity={0.75}>
                      <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <View
                style={[
                  styles.createRoutineSectionCard,
                  { borderColor: groceriesTheme.itemBorder, backgroundColor: palette.card },
                ]}
              >
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.secondaryButton,
                      {
                        backgroundColor: groceriesTheme.itemBg,
                        borderColor: groceriesTheme.itemBorder,
                      },
                    ]}
                    onPress={closeGroceryListEditor}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.secondaryButtonText, { color: themeColors.text }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.primaryButton,
                      { backgroundColor: groceriesTheme.accent },
                      !groceryListNameInput.trim() && styles.primaryButtonDisabled,
                    ]}
                    onPress={handleSaveGroceryList}
                    disabled={!groceryListNameInput.trim()}
                    activeOpacity={0.85}
                  >
                    <View style={styles.primaryButtonInner}>
                      <Text style={styles.primaryButtonText}>
                        {isEditingActiveGroceryList ? 'Save Changes' : 'Create List'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : !selectedGroceryList ? (
            <View style={styles.createRoutineBody}>
              <View
                style={[
                  styles.groceryHeroCard,
                  { backgroundColor: groceriesTheme.itemBg, borderColor: groceriesTheme.itemBorder },
                ]}
              >
                <Text style={styles.groceryHeroTitle}>Plan lists and stay organized.</Text>
                <Text style={styles.groceryHeroSubtitle}>
                  Create as many lists as you need, set an emoji, and manage items inside each list.
                </Text>
              </View>

              <View
                style={[
                  styles.createRoutineSectionCard,
                  { borderColor: groceriesTheme.itemBorder, backgroundColor: palette.card },
                ]}
              >
                <Text style={styles.inputLabel}>Quick Lists</Text>
                <Text style={styles.quickListsHint}>
                  One tap to create a starter list with name and emoji.
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickListsRow}
                >
                  {QUICK_LIST_TEMPLATES.map((template) => (
                    <TouchableOpacity
                      key={template.id}
                      style={[
                        styles.quickListChip,
                        {
                          backgroundColor: groceriesTheme.itemBg,
                          borderColor: groceriesTheme.itemBorder,
                        },
                      ]}
                      onPress={() => handleCreateQuickList(template)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.quickListChipEmoji}>{template.emoji}</Text>
                      <Text style={styles.quickListChipText}>{template.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View
                style={[
                  styles.createRoutineSectionCard,
                  { borderColor: groceriesTheme.itemBorder, backgroundColor: palette.card },
                ]}
              >
                {groceryListSummaries.length === 0 ? (
                  <Text style={styles.emptyText}>No lists yet</Text>
                ) : (
                  groceryListSummaries.map((list) => (
                    <TouchableOpacity
                      key={list.id}
                      style={[
                        styles.groceryListCard,
                        { backgroundColor: groceriesTheme.itemBg, borderColor: groceriesTheme.itemBorder },
                      ]}
                      onPress={() => openGroceryListDetail(list.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.groceryListCardEmoji}>
                        {list.emoji || DEFAULT_GROCERY_EMOJI}
                      </Text>
                      <View style={styles.groceryListCardContent}>
                        <Text style={styles.groceryListCardTitle}>{list.name}</Text>
                        <Text style={styles.groceryListCardMeta}>
                          {list.activeCount} open | {list.completedCount} done
                        </Text>
                        {(list.dueDate || list.dueTime) ? (
                          <Text style={styles.groceryDueMeta}>
                            {formatDueSummary(list.dueDate, list.dueTime, '')}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={themeColors.textLight} />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          ) : (
            <View style={styles.createRoutineBody}>
              {groceryListSummaries.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.grocerySwitchRow}
                  contentContainerStyle={styles.grocerySwitchContent}
                >
                  {groceryListSummaries.map((list) => {
                    const isActive = list.id === selectedGroceryList.id;
                    return (
                      <TouchableOpacity
                        key={list.id}
                        style={[
                          styles.grocerySwitchChip,
                          isActive && [
                            styles.grocerySwitchChipActive,
                            {
                              borderColor: groceriesTheme.accent,
                              backgroundColor: groceriesTheme.itemBg,
                            },
                          ],
                        ]}
                        onPress={() => openGroceryListDetail(list.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.grocerySwitchChipText}>
                          {list.emoji || DEFAULT_GROCERY_EMOJI} {list.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <View
                style={[
                  styles.grocerySelectedListCard,
                  { backgroundColor: groceriesTheme.itemBg, borderColor: groceriesTheme.itemBorder },
                ]}
              >
                <Text style={styles.grocerySelectedListEmoji}>
                  {selectedGroceryList.emoji || DEFAULT_GROCERY_EMOJI}
                </Text>
                <View style={styles.grocerySelectedListMeta}>
                  <Text style={styles.grocerySelectedListTitle}>{selectedGroceryList.name}</Text>
                  <Text style={styles.grocerySelectedListSubtitle}>
                    {activeGroceries.length} open | {completedGroceries.length} completed
                  </Text>
                  {(selectedGroceryList.dueDate || selectedGroceryList.dueTime) ? (
                    <Text style={styles.groceryDueMeta}>
                      {formatDueSummary(selectedGroceryList.dueDate, selectedGroceryList.dueTime, '')}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[
                    styles.groceryDetailAddButton,
                    { backgroundColor: groceriesTheme.itemBg, borderColor: groceriesTheme.itemBorder },
                  ]}
                  onPress={openGroceryItemCreator}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color={groceriesTheme.accent} />
                </TouchableOpacity>
              </View>

              {isGroceryItemEditorOpen ? (
                <View
                  style={[
                    styles.createRoutineSectionCard,
                    { borderColor: groceriesTheme.itemBorder, backgroundColor: palette.card },
                  ]}
                >
                  <Text style={styles.inputLabel}>Create item</Text>
                  <View style={styles.groceryInputContainer}>
                    <TextInput
                      style={[
                        styles.groceryInput,
                        {
                          backgroundColor: groceriesTheme.itemBg,
                          borderColor: groceriesTheme.itemBorder,
                          color: themeColors.text,
                        },
                      ]}
                      value={groceryItemInput}
                      onChangeText={setGroceryItemInput}
                      placeholder={`Add item to ${selectedGroceryList.name}...`}
                      placeholderTextColor={themeColors.placeholder}
                      onSubmitEditing={handleAddGroceryItem}
                      returnKeyType="done"
                      autoFocus
                    />
                  </View>
                  <View style={styles.dateTimeRow}>
                    <View style={styles.dateInput}>
                      <Text style={styles.inputLabel}>Item Date</Text>
                      <TouchableOpacity
                        style={[
                          styles.dateButton,
                          {
                            backgroundColor: groceriesTheme.itemBg,
                            borderColor: groceriesTheme.itemBorder,
                          },
                        ]}
                        onPress={() => openGroceryDatePicker('item')}
                      >
                        <Text style={[styles.dateButtonText, !groceryItemDueDate && styles.placeholderText]}>
                          {groceryItemDueDate ? formatDate(groceryItemDueDate) : 'Choose date'}
                        </Text>
                        <Ionicons name="calendar-outline" size={18} color={themeColors.textLight} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.timeInput}>
                      <Text style={styles.inputLabel}>Item Time</Text>
                      <TouchableOpacity
                        style={[
                          styles.dateButton,
                          {
                            backgroundColor: groceriesTheme.itemBg,
                            borderColor: groceriesTheme.itemBorder,
                          },
                        ]}
                        onPress={() => openGroceryTimePicker('item')}
                      >
                        <Text style={[styles.dateButtonText, !groceryItemDueTime && styles.placeholderText]}>
                          {groceryItemDueTime || '--:--'}
                        </Text>
                        <Ionicons name="time-outline" size={18} color={themeColors.textLight} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.groceryDueActions}>
                    <Text style={styles.groceryDueMeta}>
                      {formatDueSummary(groceryItemDueDate, groceryItemDueTime, 'No due date or time set')}
                    </Text>
                    {(groceryItemDueDate || groceryItemDueTime) ? (
                      <TouchableOpacity onPress={clearGroceryItemDue} activeOpacity={0.75}>
                        <Text style={styles.clearText}>Clear</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        styles.secondaryButton,
                        {
                          backgroundColor: groceriesTheme.itemBg,
                          borderColor: groceriesTheme.itemBorder,
                        },
                      ]}
                      onPress={closeGroceryItemCreator}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.secondaryButtonText, { color: themeColors.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        styles.primaryButton,
                        { backgroundColor: groceriesTheme.accent },
                        !groceryItemInput.trim() && styles.primaryButtonDisabled,
                      ]}
                      onPress={handleAddGroceryItem}
                      disabled={!groceryItemInput.trim()}
                      activeOpacity={0.85}
                    >
                      <View style={styles.primaryButtonInner}>
                        <Text style={styles.primaryButtonText}>Create Item</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {renderActiveGroceryList()}
            </View>
          )}
          </Animated.View>
        </View>

        <PlatformDatePicker
          visible={showGroceryDatePicker}
          value={groceryPickerTarget === 'item' ? groceryItemDueDate : groceryListDueDate}
          onChange={handleSelectGroceryDate}
          onClose={() => {
            setShowGroceryDatePicker(false);
            setGroceryPickerTarget(null);
          }}
          accentColor={groceriesTheme.accent}
        />

        <PlatformTimePicker
          visible={showGroceryTimePicker}
          value={groceryPickerTarget === 'item' ? groceryItemDueTime : groceryListDueTime}
          onChange={handleSelectGroceryTime}
          onClose={() => {
            setShowGroceryTimePicker(false);
            setGroceryPickerTarget(null);
          }}
          options={reminderTimeOptions}
          accentColor={groceriesTheme.accent}
        />
      </Modal>

      {/* Add Reminder Modal */}
      <Modal
        visible={showReminderModal}
        onClose={closeReminderModal}
        title="Add Reminder"
        fullScreen
        hideHeader
        showCloseButton={false}
        contentStyle={{ paddingHorizontal: 0 }}
      >
        <View
          style={[
            styles.createRoutineScreen,
            { backgroundColor: palette.background, paddingTop: insets.top + spacing.sm },
          ]}
        >
          <View style={styles.createRoutineTop}>
            <TouchableOpacity
              style={[
                styles.createRoutineTopButton,
                { borderColor: reminderModal.border, backgroundColor: reminderModal.surface },
              ]}
              onPress={closeReminderModal}
            >
              <Ionicons name="chevron-back" size={20} color={reminderModal.accent} />
            </TouchableOpacity>
            <Text style={[styles.createRoutineTitle, { color: reminderModal.accent }]}>
              Add Reminder
            </Text>
            <View style={styles.createRoutineTopSpacer} />
          </View>
          <View style={styles.createRoutineBody}>
            <View
              style={[
                styles.createRoutineSectionCard,
                { backgroundColor: reminderModal.surface, borderColor: reminderModal.border },
              ]}
            >
              <Input
                label="Reminder Name"
                value={reminderName}
                onChangeText={setReminderName}
                placeholder="e.g., Call mom"
                containerStyle={styles.modalInputContainer}
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: reminderModal.fieldBg,
                    borderColor: reminderModal.fieldBorder,
                  },
                ]}
                inputStyle={styles.modalInputText}
              />
              <Input
                label="Description (Optional)"
                value={reminderDescription}
                onChangeText={setReminderDescription}
                placeholder="Add details..."
                multiline
                numberOfLines={2}
                containerStyle={styles.modalInputContainer}
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: reminderModal.fieldBg,
                    borderColor: reminderModal.fieldBorder,
                  },
                ]}
                inputStyle={styles.modalInputText}
              />
            </View>
            <View
              style={[
                styles.createRoutineSectionCard,
                { backgroundColor: reminderModal.surface, borderColor: reminderModal.border },
              ]}
            >
              <View style={styles.dateTimeRow}>
                <View style={styles.dateInput}>
                  <Text style={styles.inputLabel}>Date</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      {
                        backgroundColor: reminderModal.fieldBg,
                        borderColor: reminderModal.fieldBorder,
                      },
                    ]}
                    onPress={openReminderDatePicker}
                  >
                    <Text style={styles.dateButtonText}>{formatDate(reminderDate)}</Text>
                    <Ionicons name="calendar-outline" size={18} color={themeColors.textLight} />
                  </TouchableOpacity>
                </View>
                <View style={styles.timeInput}>
                  <Text style={styles.inputLabel}>Time</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      {
                        backgroundColor: reminderModal.fieldBg,
                        borderColor: reminderModal.fieldBorder,
                      },
                    ]}
                    onPress={openReminderTimePicker}
                  >
                    <Text style={[styles.dateButtonText, !reminderTime && styles.placeholderText]}>
                      {reminderTime || '--:--'}
                    </Text>
                    <Ionicons name="time-outline" size={18} color={themeColors.textLight} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.quickLabel}>Quick times</Text>
              <View style={styles.quickGroup}>
                {REMINDER_QUICK_TIMES.map((time) => {
                  const selected = normalizedReminderTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.quickChip,
                        {
                          backgroundColor: selected
                            ? reminderModal.chipActiveBg
                            : reminderModal.chipBg,
                          borderColor: selected
                            ? reminderModal.chipActiveBorder
                            : reminderModal.chipBorder,
                        },
                      ]}
                      onPress={() => handleQuickReminderTime(time)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          {
                            color: selected
                              ? reminderModal.chipActiveText
                              : reminderModal.chipText,
                          },
                        ]}
                      >
                        {time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View
              style={[
                styles.createRoutineSectionCard,
                { backgroundColor: reminderModal.surface, borderColor: reminderModal.border },
              ]}
            >
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.secondaryButton,
                    {
                      backgroundColor: reminderModal.secondaryBg,
                      borderColor: reminderModal.secondaryBorder,
                    },
                  ]}
                  onPress={closeReminderModal}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: reminderModal.secondaryText },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.primaryButton,
                    !reminderName.trim() && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleCreateReminder}
                  disabled={!reminderName.trim()}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={reminderModal.actionGradient}
                    style={styles.primaryButtonInner}
                  >
                    <Text style={styles.primaryButtonText}>Add Reminder</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <PlatformDatePicker
          visible={showReminderDatePicker}
          value={reminderDate}
          onChange={handleSelectReminderDate}
          onClose={() => setShowReminderDatePicker(false)}
          accentColor={reminderModal.accent}
        />

        <PlatformTimePicker
          visible={showReminderTimePicker}
          value={reminderTime}
          onChange={handleSelectReminderTime}
          onClose={() => setShowReminderTimePicker(false)}
          options={reminderTimeOptions}
          accentColor={reminderModal.accent}
        />
      </Modal>

    </View>
  );
};

const createStyles = (themeColors, palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Platform.OS === 'android' ? '#E9E4F0' : palette.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Platform.OS === 'android' ? spacing.sm : spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: Platform.OS === 'android' ? 'flex-start' : 'center',
    justifyContent: 'space-between',
    marginBottom: Platform.OS === 'android' ? spacing.sm : spacing.md,
  },
  pageTitle: {
    ...typography.h1,
    fontSize: Platform.OS === 'android' ? 24 : 34,
    fontWeight: '700',
    textTransform: Platform.OS === 'android' ? 'uppercase' : 'none',
    letterSpacing: Platform.OS === 'android' ? 1.2 : 0,
  },
  pageSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
    fontSize: Platform.OS === 'android' ? 12 : typography.bodySmall.fontSize,
  },
  headerAddWrap: {
    width: Platform.OS === 'android' ? 36 : 42,
    height: Platform.OS === 'android' ? 36 : 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddButton: {
    width: Platform.OS === 'android' ? 36 : 42,
    height: Platform.OS === 'android' ? 36 : 42,
    borderRadius: Platform.OS === 'android' ? 2 : 21,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'android' ? {} : shadows.small),
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: Platform.OS === 'android' ? spacing.sm : spacing.md,
  },
  statCard: {
    flex: 1,
    marginHorizontal: Platform.OS === 'android' ? 2 : 4,
    borderRadius: Platform.OS === 'android' ? 2 : borderRadius.lg,
    borderWidth: Platform.OS === 'android' ? 2 : 1,
    padding: Platform.OS === 'android' ? spacing.sm : spacing.md,
  },
  statRoutine: {
    backgroundColor: palette.isDark ? '#2A2340' : '#F2EFFF',
    borderColor: palette.isDark ? '#463866' : '#E1DAFF',
  },
  statTasks: {
    backgroundColor: palette.isDark ? '#1D3246' : '#EAF6FF',
    borderColor: palette.isDark ? '#2D4E6D' : '#CFE7FF',
  },
  statReminders: {
    backgroundColor: palette.isDark ? '#3A2033' : '#FFF1F8',
    borderColor: palette.isDark ? '#5A2F4F' : '#FFD6EB',
  },
  statLabel: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  statValue: {
    ...typography.h2,
    marginTop: 2,
    fontWeight: '700',
    color: palette.text,
  },
  sectionCard: {
    marginBottom: Platform.OS === 'android' ? spacing.sm : spacing.md,
    borderRadius: Platform.OS === 'android' ? 2 : borderRadius.xl,
    borderWidth: Platform.OS === 'android' ? 2 : 1,
    padding: Platform.OS === 'android' ? spacing.sm : spacing.md,
  },
  lastCard: {
    marginBottom: spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: Platform.OS === 'android' ? 'flex-start' : 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: Platform.OS === 'android' ? 24 : 32,
    height: Platform.OS === 'android' ? 24 : 32,
    borderRadius: Platform.OS === 'android' ? 2 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  sectionBody: {
    paddingTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.body,
    color: palette.text,
    fontWeight: '700',
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: palette.cardBorder,
  },
  sectionActionText: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.bodySmall,
    color: themeColors.textLight,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  routineSection: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  routineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routineBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  routineName: {
    ...typography.label,
    color: themeColors.text,
  },
  routineMeta: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  routineActions: {
    flexDirection: 'row',
  },
  routineActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    borderWidth: 1,
  },
  routineTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  taskOrderControls: {
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  orderButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginVertical: 2,
  },
  routineTaskText: {
    flex: 1,
    ...typography.body,
    color: themeColors.text,
  },
  noTasksText: {
    ...typography.bodySmall,
    color: themeColors.textLight,
    fontStyle: 'italic',
    paddingLeft: spacing.xl,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  reminderIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  reminderTitle: {
    ...typography.body,
    fontWeight: '500',
    color: themeColors.text,
  },
  reminderDescription: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  reminderDate: {
    ...typography.caption,
    color: themeColors.textLight,
    marginTop: spacing.xs,
  },
  groceryOverviewMeta: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginBottom: spacing.sm,
  },
  groceryListPreviewStack: {
    marginTop: spacing.xs,
  },
  groceryListPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  groceryListPreviewEmoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  groceryListPreviewContent: {
    flex: 1,
  },
  groceryListPreviewTitle: {
    ...typography.body,
    color: themeColors.text,
    fontWeight: '600',
  },
  groceryListPreviewMeta: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  groceryDueMeta: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  groceryMoreListsText: {
    ...typography.caption,
    color: themeColors.textLight,
    textAlign: 'center',
    paddingTop: spacing.xs,
  },
  groceryHeroCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  groceryHeroTitle: {
    ...typography.h2,
    color: themeColors.text,
    fontWeight: '700',
  },
  groceryHeroSubtitle: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  quickListsHint: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginBottom: spacing.sm,
  },
  quickListsRow: {
    paddingRight: spacing.sm,
  },
  quickListChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  quickListChipEmoji: {
    fontSize: 18,
    marginRight: spacing.xs,
  },
  quickListChipText: {
    ...typography.bodySmall,
    color: themeColors.text,
    fontWeight: '600',
  },
  groceryListCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groceryEmojiInput: {
    width: 52,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 24,
    marginRight: spacing.sm,
  },
  groceryEmojiScroll: {
    paddingTop: spacing.sm,
  },
  groceryEmojiChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: themeColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    backgroundColor: themeColors.card,
  },
  groceryEmojiChipText: {
    fontSize: 20,
  },
  groceryListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  groceryListCardEmoji: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  groceryListCardContent: {
    flex: 1,
  },
  groceryListCardTitle: {
    ...typography.body,
    color: themeColors.text,
    fontWeight: '600',
  },
  groceryListCardMeta: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  grocerySelectedListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  grocerySelectedListEmoji: {
    fontSize: 34,
    marginRight: spacing.md,
  },
  grocerySelectedListMeta: {
    flex: 1,
  },
  groceryDetailAddButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  grocerySelectedListTitle: {
    ...typography.h3,
    color: themeColors.text,
    fontWeight: '700',
  },
  grocerySelectedListSubtitle: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  groceryDueActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  groceryEmptyEmoji: {
    fontSize: 36,
    marginBottom: spacing.xs,
  },
  grocerySceneContainer: {
    flex: 1,
  },
  grocerySwitchRow: {
    marginBottom: spacing.sm,
  },
  grocerySwitchContent: {
    paddingRight: spacing.sm,
  },
  grocerySwitchChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: themeColors.border,
    backgroundColor: themeColors.card,
    marginRight: spacing.sm,
  },
  grocerySwitchChipActive: {
    ...shadows.small,
  },
  grocerySwitchChipText: {
    ...typography.bodySmall,
    color: themeColors.text,
    fontWeight: '600',
  },
  groceryInputContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  groceryInput: {
    flex: 1,
    height: 44,
    backgroundColor: themeColors.inputBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: themeColors.text,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  groceryAddButton: {
    width: 44,
    height: 44,
    marginLeft: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: themeColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  groceryItemContent: {
    flex: 1,
  },
  groceryCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: themeColors.border,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryCheckboxChecked: {
    backgroundColor: themeColors.success,
    borderColor: themeColors.success,
  },
  groceryText: {
    ...typography.body,
    color: themeColors.text,
  },
  groceryItemDueText: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  groceryItemDueTextCompleted: {
    color: themeColors.textLight,
  },
  groceryTextCompleted: {
    textDecorationLine: 'line-through',
    color: themeColors.textLight,
  },
  completedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: themeColors.divider,
  },
  completedLabel: {
    ...typography.caption,
    color: themeColors.textLight,
  },
  clearText: {
    ...typography.bodySmall,
    color: themeColors.danger,
  },
  modalScreen: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  createRoutineScreen: {
    flex: 1,
  },
  createRoutineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  createRoutineTopButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRoutineTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  createRoutineTopSpacer: {
    width: 38,
    height: 38,
  },
  groceryTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createRoutineBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  createRoutineSectionCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  modalCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    ...shadows.large,
  },
  modalHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    minHeight: 96,
    justifyContent: 'center',
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    ...typography.h2,
    color: '#FFFFFF',
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  modalCloseButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalInputContainer: {
    marginBottom: spacing.md,
  },
  modalInput: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    backgroundColor: themeColors.inputBackground,
  },
  modalInputText: {
    color: themeColors.text,
  },
  quickLabel: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  quickGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  quickChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickChipText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  scheduleHint: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginBottom: spacing.sm,
  },
  scheduleValidationHint: {
    ...typography.caption,
    color: themeColors.danger,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  rangePreview: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  secondaryButton: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  primaryButtonInner: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  inputLabel: {
    ...typography.label,
    color: themeColors.text,
    marginBottom: spacing.sm,
  },
  chipGroup: {
    marginBottom: spacing.lg,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.border,
    backgroundColor: themeColors.inputBackground,
    marginBottom: spacing.md,
  },
  dateButtonText: {
    ...typography.body,
    color: themeColors.text,
  },
  placeholderText: {
    color: themeColors.placeholder,
  },
  dateTimeRow: {
    flexDirection: 'row',
  },
  routineRangeRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  routineRangeButton: {
    flex: 1,
    marginRight: spacing.sm,
  },
  dateInput: {
    flex: 1,
    marginRight: spacing.md,
  },
  timeInput: {
    flex: 1,
  },
});

export default RoutineScreen;
