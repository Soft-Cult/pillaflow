import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Keyboard,
  TextInput,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../utils/supabaseClient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { formatTimeFromDate } from '../utils/notifications';
import {
  Card,
  Modal,
  Button,
  Input,
  PlatformDatePicker,
  PlatformTimePicker,
  PlatformScrollView,
} from '../components';
import {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
  priorityLevels,
} from '../utils/theme';
import {
  DEFAULT_TASK_DURATION_MINUTES,
  findOverlappingTasks,
  formatTaskTimeRangeLabel,
  getTaskOverlapPairs,
  normalizeTaskDurationMinutes,
} from '../utils/taskScheduling';

const TIME_OPTIONS = Array.from({ length: 48 }).map((_, idx) => {
  const h = Math.floor(idx / 2);
  const m = idx % 2 === 0 ? '00' : '30';
  const hour12 = ((h + 11) % 12) + 1;
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${m} ${suffix}`;
});

const TASK_QUICK_DATES = [
  { label: 'Today', offset: 0 },
  { label: 'Tomorrow', offset: 1 },
  { label: 'Next Week', offset: 7 },
];
const TASK_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TASK_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const TASK_QUICK_TIMES = ['09:00', '12:00', '15:00', '18:00', '20:00'];
const TASK_QUICK_DURATIONS = [15, 30, 45, 60, 90, 120];
const TASK_FILTER_TAB_ALL = 'All';
const TASK_FILTER_TAB_TASKS = 'Tasks';
const TASK_FILTER_TAB_HOLIDAYS = 'Holidays';
const TASK_CATEGORY_TASK = 'task';
const TASK_CATEGORY_HOLIDAY = 'holiday';
const TASK_CATEGORY_OPTIONS = [
  { value: TASK_CATEGORY_TASK, label: 'Task' },
  { value: TASK_CATEGORY_HOLIDAY, label: 'Holiday/Event' },
];

const normalizeTaskCategory = (value, fallback = TASK_CATEGORY_TASK) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === TASK_CATEGORY_HOLIDAY || normalized === 'event' || normalized === 'events') {
    return TASK_CATEGORY_HOLIDAY;
  }
  if (normalized === TASK_CATEGORY_TASK || normalized === 'tasks') {
    return TASK_CATEGORY_TASK;
  }
  return fallback === TASK_CATEGORY_HOLIDAY ? TASK_CATEGORY_HOLIDAY : TASK_CATEGORY_TASK;
};

const getISODateWithOffset = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().split('T')[0];
};

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

const TasksScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const {
    tasks,
    friends,
    groups,
    addTask,
    shareTaskWithGroup,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    sendTaskInvite,
    fetchTaskParticipants,
    addNote,
    updateNote,
    deleteNote,
    getTodayTasks,
    getUpcomingTasks,
    verifyNotePassword,
    setNotePassword,
    todayHealth,
    updateTodayHealth,
    themeName,
    themeColors,
    ensureTasksLoaded,
    ensureGroupDataLoaded,
    userSettings,
    importTasksFromDeviceCalendar,
    exportTasksToDeviceCalendar,
    undoImportedCalendarTasks,
  } = useApp();
  const isDark = themeName === 'dark';
  const tasksTheme = useMemo(
    () => ({
      background: isDark ? themeColors.background : '#FBF5FF',
      actionGradient: [themeColors.tasks, themeColors.tasks],
      actionText: '#FFFFFF',
      actionSecondaryBg: isDark ? '#2F3147' : '#FFFFFF',
      actionSecondaryBorder: isDark ? `${themeColors.tasks}66` : `${themeColors.tasks}33`,
      actionSecondaryText: themeColors.tasks,
      calendarBg: isDark ? '#2F3147' : '#FFFFFF',
      calendarBorder: isDark ? '#3E415A' : '#E5E7EB',
      calendarIcon: isDark ? '#E5E7EB' : themeColors.textSecondary,
      tabsBorder: isDark ? '#4B4760' : '#E7E1F5',
      tabActive: isDark ? '#C084FC' : themeColors.primary,
      tabText: isDark ? '#C9C4D8' : themeColors.textSecondary,
      tabTextActive: isDark ? '#E9D5FF' : themeColors.primary,
      filterIconBg: isDark ? '#2F2B3F' : '#FFFFFF',
      filterIconBorder: isDark ? '#3F3A53' : '#E5E7EB',
      filterIconColor: isDark ? '#C9C4D8' : themeColors.textSecondary,
      filterChipBg: isDark ? '#2F2B3F' : '#FFFFFF',
      filterChipBorder: isDark ? '#3F3A53' : '#E5E7EB',
      filterChipActiveBg: isDark ? '#5B3B76' : '#F0E7FF',
      filterChipActiveBorder: isDark ? '#7A56A0' : '#D9C7FF',
      filterChipText: isDark ? '#C9C4D8' : themeColors.textSecondary,
      filterChipTextActive: isDark ? '#F1E8FF' : themeColors.primary,
      tasksCardBg: isDark ? '#3E4158' : '#FFFFFF',
      tasksCardBorder: isDark ? '#4B4E67' : '#EFE4FF',
      tasksTitle: isDark ? '#D8B4FE' : themeColors.primary,
      taskItemBg: isDark ? '#4B3E5E' : '#F8F1FF',
      taskItemBorder: isDark ? 'rgba(192,132,252,0.4)' : '#E7D7FF',
      checkboxBg: isDark ? '#3B3452' : '#FFFFFF',
      taskDate: isDark ? '#C9C4D8' : themeColors.textSecondary,
      notesCardBg: isDark ? '#34445E' : '#FFFFFF',
      notesCardBorder: isDark ? '#435678' : '#DCEBFF',
      notesTitle: isDark ? '#7DD3FC' : themeColors.tasks,
      noteItemBg: isDark ? '#2C3E54' : '#F2F8FF',
      noteItemBorder: isDark ? 'rgba(96,165,250,0.35)' : '#D8E7FF',
      noteIconBg: '#0EA5E9',
      noteIconColor: '#FFFFFF',
      noteLockBg: isDark ? '#3C2E57' : '#EFE7FF',
      noteLockColor: isDark ? '#D8B4FE' : themeColors.primary,
      noteChevron: isDark ? '#AFAAC2' : themeColors.textLight,
      addNewBg: isDark ? '#2C3E54' : '#EEF4FF',
      addNewBorder: isDark ? '#3B4F6C' : '#DDEBFF',
      addNewText: isDark ? '#7DD3FC' : themeColors.tasks,
    }),
    [isDark, themeColors]
  );
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const calendarTransitionProgress = useRef(new Animated.Value(0)).current;
  const calendarChevronProgress = useRef(new Animated.Value(0)).current;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarView, setIsCalendarView] = useState(false);
  const [isCalendarTransitioning, setIsCalendarTransitioning] = useState(false);
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [calendarSyncAction, setCalendarSyncAction] = useState(null);
  const [activeTab, setActiveTab] = useState(TASK_FILTER_TAB_ALL);
  const [filterType, setFilterType] = useState('Date');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [showNoteDetailModal, setShowNoteDetailModal] = useState(false);
  const [showNoteSecurityModal, setShowNoteSecurityModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showPeopleModal, setShowPeopleModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [invitedFriendIds, setInvitedFriendIds] = useState([]);
  const [invitingFriends, setInvitingFriends] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [taskPeople, setTaskPeople] = useState([]);
  const [loadingTaskPeople, setLoadingTaskPeople] = useState(false);
  const [noteToUnlock, setNoteToUnlock] = useState(null);
  const [unlockedNoteIds, setUnlockedNoteIds] = useState([]);
  const [noteTitleDraft, setNoteTitleDraft] = useState('');
  const [noteContentDraft, setNoteContentDraft] = useState('');

  // Note security state
  const [currentNotePassword, setCurrentNotePassword] = useState('');
  const [newNotePassword, setNewNotePassword] = useState('');
  const [confirmNotePassword, setConfirmNotePassword] = useState('');
  const [securityError, setSecurityError] = useState('');

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskCategory, setTaskCategory] = useState(TASK_CATEGORY_TASK);
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskTime, setTaskTime] = useState('');
  const [taskDurationInput, setTaskDurationInput] = useState(
    String(DEFAULT_TASK_DURATION_MINUTES)
  );
  const normalizedTaskTime = useMemo(
    () => normalizeTimeValue(taskTime),
    [taskTime]
  );
  const normalizedTaskDurationMinutes = useMemo(
    () =>
      normalizeTaskDurationMinutes(
        taskDurationInput,
        DEFAULT_TASK_DURATION_MINUTES
      ),
    [taskDurationInput]
  );

  // Note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteBodyViewportHeight, setNoteBodyViewportHeight] = useState(0);
  const [noteTitleHeight, setNoteTitleHeight] = useState(0);
  const [noteContentMeasuredHeight, setNoteContentMeasuredHeight] = useState(0);
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const noteContentInputRef = useRef(null);
  const noteContentMinHeight = useMemo(() => {
    if (!noteBodyViewportHeight) return 260;
    const verticalPadding = spacing.md + spacing.xxxl;
    const availableHeight =
      noteBodyViewportHeight - noteTitleHeight - verticalPadding - spacing.md;
    return Math.max(260, availableHeight);
  }, [noteBodyViewportHeight, noteTitleHeight]);
  const noteContentHeight = useMemo(
    () => Math.max(noteContentMinHeight, noteContentMeasuredHeight + spacing.md),
    [noteContentMeasuredHeight, noteContentMinHeight]
  );

  const tabs = [TASK_FILTER_TAB_ALL, TASK_FILTER_TAB_TASKS, TASK_FILTER_TAB_HOLIDAYS];
  const filters = ['Date', 'Priority', 'A-Z'];
  const timeOptions = TIME_OPTIONS;
  const selectedGroup = useMemo(
    () => (groups || []).find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  useEffect(() => {
    ensureTasksLoaded();
    ensureGroupDataLoaded();
  }, [ensureGroupDataLoaded, ensureTasksLoaded]);

  const weekDays = useMemo(() => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }

    return days;
  }, [currentDate]);

  const goToPreviousWeek = () => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(nextDate);
  };

  const goToNextWeek = () => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(nextDate);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const isToday = (date) => date.toDateString() === new Date().toDateString();

  const isSelectedDate = (date) =>
    date.toDateString() === selectedDate.toDateString();

  const hasTasksOnDate = (date) =>
    (tasks || []).some((task) => {
      if (!task?.date) return false;
      const dateVal = new Date(task.date);
      if (Number.isNaN(dateVal.getTime())) return false;
      return dateVal.toDateString() === date.toDateString();
    });

  const handleDaySelect = (day) => {
    setSelectedDate(day);
    setCurrentDate(day);
  };

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Filter by tab
    switch (activeTab) {
      case TASK_FILTER_TAB_TASKS:
        filtered = filtered.filter(
          (task) => normalizeTaskCategory(task?.category) === TASK_CATEGORY_TASK
        );
        break;
      case TASK_FILTER_TAB_HOLIDAYS:
        filtered = filtered.filter(
          (task) => normalizeTaskCategory(task?.category) === TASK_CATEGORY_HOLIDAY
        );
        break;
      default:
        break;
    }

    filtered = filtered.filter((task) => {
      if (!task?.date) return false;
      const taskDate = new Date(task.date);
      if (Number.isNaN(taskDate.getTime())) return false;
      return taskDate.toDateString() === selectedDate.toDateString();
    });

    // Sort by filter
    switch (filterType) {
      case 'Priority':
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        filtered.sort(
          (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
        );
        break;
      case 'A-Z':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'Date':
      default:
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
    }

    return filtered;
  }, [tasks, activeTab, filterType, selectedDate]);

  const taskSectionTitle = useMemo(() => {
    if (activeTab === TASK_FILTER_TAB_TASKS) return 'Tasks';
    if (activeTab === TASK_FILTER_TAB_HOLIDAYS) return 'Holidays & Events';
    return 'All';
  }, [activeTab]);

  const emptyStateTitle = useMemo(() => {
    if (activeTab === TASK_FILTER_TAB_HOLIDAYS) return 'No holidays/events for this day';
    if (activeTab === TASK_FILTER_TAB_TASKS) return 'No tasks for this day';
    return 'Nothing scheduled for this day';
  }, [activeTab]);

  const emptyStateSubtitle = useMemo(() => {
    if (activeTab === TASK_FILTER_TAB_HOLIDAYS) {
      return 'Pick another date or create a holiday/event for this day';
    }
    if (activeTab === TASK_FILTER_TAB_TASKS) {
      return 'Pick another date or create a task for this day';
    }
    return 'Pick another date or create a task or holiday/event';
  }, [activeTab]);

  const activeScheduledTasks = useMemo(
    () =>
      (tasks || []).filter(
        (task) =>
          task?.date &&
          task?.time &&
          normalizeTaskCategory(task?.category) !== TASK_CATEGORY_HOLIDAY
      ),
    [tasks]
  );

  const taskOverlapPairs = useMemo(
    () =>
      getTaskOverlapPairs(activeScheduledTasks, {
        includeCompleted: false,
        fallbackDurationMinutes: DEFAULT_TASK_DURATION_MINUTES,
      }),
    [activeScheduledTasks]
  );

  const selectedDateOverlapPairs = useMemo(() => {
    const selectedDateKey = selectedDate.toDateString();
    return taskOverlapPairs.filter((pair) => {
      if (!pair?.a?.date) return false;
      const pairDate = new Date(pair.a.date);
      if (Number.isNaN(pairDate.getTime())) return false;
      return pairDate.toDateString() === selectedDateKey;
    });
  }, [selectedDate, taskOverlapPairs]);

  const parseHour = (timeString) => {
    if (!timeString) return null;
    const trimmed = String(timeString).trim();

    const match12 = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(trimmed);
    if (match12) {
      let hour = parseInt(match12[1], 10) % 12;
      if (match12[3].toLowerCase() === 'pm') hour += 12;
      return { hour, minutes: parseInt(match12[2], 10) };
    }

    const match24 = /^(\d{1,2}):(\d{2})/.exec(trimmed);
    if (match24) {
      return {
        hour: parseInt(match24[1], 10),
        minutes: parseInt(match24[2], 10),
      };
    }

    return null;
  };

  const selectedDateTasks = useMemo(() => {
    const selectedKey = selectedDate.toDateString();
    return (tasks || [])
      .filter((task) => {
        if (!task?.date) return false;
        const dateVal = new Date(task.date);
        if (Number.isNaN(dateVal.getTime())) return false;
        return dateVal.toDateString() === selectedKey;
      })
      .sort((a, b) => {
        const aParsed = parseHour(a.time);
        const bParsed = parseHour(b.time);
        if (!aParsed && !bParsed) return 0;
        if (!aParsed) return 1;
        if (!bParsed) return -1;
        const aMinutes = aParsed.hour * 60 + aParsed.minutes;
        const bMinutes = bParsed.hour * 60 + bParsed.minutes;
        return aMinutes - bMinutes;
      });
  }, [selectedDate, tasks]);

  const upcomingDatedTasks = useMemo(() => {
    const selectedStart = new Date(selectedDate);
    selectedStart.setHours(0, 0, 0, 0);

    return (tasks || [])
      .filter((task) => {
        if (!task?.date) return false;
        const dateVal = new Date(task.date);
        if (Number.isNaN(dateVal.getTime())) return false;
        return dateVal >= selectedStart;
      })
      .sort((a, b) => {
        const dateDiff = new Date(a.date) - new Date(b.date);
        if (dateDiff !== 0) return dateDiff;
        const aParsed = parseHour(a.time);
        const bParsed = parseHour(b.time);
        if (!aParsed && !bParsed) return 0;
        if (!aParsed) return 1;
        if (!bParsed) return -1;
        return aParsed.hour * 60 + aParsed.minutes - (bParsed.hour * 60 + bParsed.minutes);
      });
  }, [selectedDate, tasks]);

  const timeSlots = useMemo(
    () => Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`),
    []
  );

  const draftTaskOverlaps = useMemo(() => {
    if (!taskDate || !taskTime) return [];
    return findOverlappingTasks(
      {
        date: taskDate,
        time: taskTime,
        durationMinutes: normalizedTaskDurationMinutes,
      },
      activeScheduledTasks,
      {
        includeCompleted: false,
        fallbackDurationMinutes: DEFAULT_TASK_DURATION_MINUTES,
      }
    );
  }, [activeScheduledTasks, normalizedTaskDurationMinutes, taskDate, taskTime]);

  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskDescription('');
    setTaskPriority('medium');
    setTaskCategory(TASK_CATEGORY_TASK);
    setTaskDate(new Date().toISOString().split('T')[0]);
    setTaskTime('');
    setTaskDurationInput(String(DEFAULT_TASK_DURATION_MINUTES));
    setShowDatePicker(false);
    setShowTimePicker(false);
    setTimePickerTarget(null);
    setInvitedFriendIds([]);
    setShowPeopleModal(false);
    setShowGroupPicker(false);
    setSelectedGroupId(null);
  };

  const closeTaskModal = () => {
    setShowTaskModal(false);
    resetTaskForm();
  };

  const handleQuickTaskDate = (offset) => {
    setTaskDate(getISODateWithOffset(offset));
    setShowDatePicker(false);
  };

  const handleQuickTaskTime = (value) => {
    setTaskTime(value);
    setShowTimePicker(false);
    setTimePickerTarget(null);
  };

  const handleQuickTaskDuration = (value) => {
    setTaskDurationInput(String(value));
  };

  const handleTaskDurationChange = (value) => {
    const numericOnly = String(value || '').replace(/[^0-9]/g, '').slice(0, 4);
    setTaskDurationInput(numericOnly);
  };

  const resetNoteForm = () => {
    setNoteTitle('');
    setNoteContent('');
  };
  const resetSecurityForm = () => {
    setCurrentNotePassword('');
    setNewNotePassword('');
    setConfirmNotePassword('');
    setSecurityError('');
  };

  const confirmTaskOverlap = (conflictingTasks = []) =>
    new Promise((resolve) => {
      const previewLines = conflictingTasks
        .slice(0, 3)
        .map(
          (task) =>
            `- ${task.title || 'Untitled'} (${formatTaskTimeRangeLabel(task)})`
        )
        .join('\n');
      const remainingCount = Math.max(0, conflictingTasks.length - 3);
      const extraLine =
        remainingCount > 0 ? `\n+${remainingCount} more overlapping task(s)` : '';
      const message = `This schedule overlaps with existing tasks.\n\n${previewLines}${extraLine}\n\nCreate it anyway?`;

      Alert.alert(
        'Schedule conflict',
        message,
        [
          {
            text: 'Back',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Create anyway',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
        {
          cancelable: true,
          onDismiss: () => resolve(false),
        }
      );
    });

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;
    if (!taskDate || Number.isNaN(new Date(taskDate).getTime())) {
      Alert.alert('Missing date', 'Please choose a date for this task.');
      return;
    }
    if (!taskTime) {
      Alert.alert('Missing time', 'Please choose a time for this task.');
      return;
    }
    if (
      normalizedTaskDurationMinutes < 5 ||
      normalizedTaskDurationMinutes > 24 * 60
    ) {
      Alert.alert(
        'Invalid duration',
        'Duration must be between 5 minutes and 24 hours.'
      );
      return;
    }

    const conflictingTasks = findOverlappingTasks(
      {
        date: taskDate,
        time: taskTime,
        durationMinutes: normalizedTaskDurationMinutes,
      },
      activeScheduledTasks,
      {
        includeCompleted: false,
        fallbackDurationMinutes: DEFAULT_TASK_DURATION_MINUTES,
      }
    );
    if (conflictingTasks.length) {
      const shouldContinue = await confirmTaskOverlap(conflictingTasks);
      if (!shouldContinue) return;
    }

    try {
      setInvitingFriends(true);
      const taskPayload = {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: taskPriority,
        category: taskCategory,
        date: taskDate,
        time: taskTime,
        durationMinutes: normalizedTaskDurationMinutes,
      };
      const createdTask = selectedGroupId
        ? await shareTaskWithGroup({ groupId: selectedGroupId, task: taskPayload })
        : await addTask(taskPayload);

      const selectedGroupMemberIds = new Set(
        (selectedGroup?.members || []).map((member) => member.id).filter(Boolean)
      );
      const inviteTargetIds = selectedGroupId
        ? invitedFriendIds.filter((friendId) => !selectedGroupMemberIds.has(friendId))
        : invitedFriendIds;

      if (inviteTargetIds.length) {
        for (const toUserId of inviteTargetIds) {
          try {
            await sendTaskInvite({ task: createdTask, toUserId });
          } catch (err) {
            Alert.alert(
              'Invite failed',
              err?.message || 'Unable to invite one of your friends.'
            );
          }
        }
      }

      resetTaskForm();
      setShowTaskModal(false);
    } catch (err) {
      Alert.alert('Unable to create task', err?.message || 'Please try again.');
    } finally {
      setInvitingFriends(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadPeople = async () => {
      if (!showTaskDetailModal || !selectedTask) {
        if (active) {
          setTaskPeople([]);
          setLoadingTaskPeople(false);
        }
        return;
      }

      const baseTaskId = selectedTask.sharedTaskId || selectedTask.id;
      setLoadingTaskPeople(true);
      try {
        const people = await fetchTaskParticipants(baseTaskId);
        if (active) setTaskPeople(people || []);
      } catch (err) {
        if (active) setTaskPeople([]);
      } finally {
        if (active) setLoadingTaskPeople(false);
      }
    };

    loadPeople();
    return () => {
      active = false;
    };
  }, [fetchTaskParticipants, selectedTask, showTaskDetailModal]);

  const toggleInvitedFriend = (userId) => {
    if (!userId) return;
    setInvitedFriendIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectedGroup = (groupId) => {
    if (!groupId) return;
    setSelectedGroupId((prev) => (prev === groupId ? null : groupId));
  };

  const handleCreateNote = async () => {
    if (!noteTitle.trim()) return;

    await addNote({
      title: noteTitle.trim(),
      content: noteContent,
    });

    resetNoteForm();
    setShowNoteModal(false);
  };

  const handleTaskPress = (task) => {
    setSelectedTask(task);
    setShowTaskDetailModal(true);
  };

  useEffect(() => {
    const taskId = route.params?.taskId;
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      handleTaskPress(task);
    }
    navigation.setParams?.({ taskId: undefined });
  }, [route.params?.taskId, tasks, navigation]);

  const handleDeleteTask = async () => {
    if (selectedTask) {
      await deleteTask(selectedTask.id);
      setShowTaskDetailModal(false);
      setSelectedTask(null);
    }
  };

  const handleCompleteTask = async () => {
    if (selectedTask) {
      const nextCompleted = !selectedTask.completed;
      await toggleTaskCompletion(selectedTask.id);
      // Keep the modal open and reflect the new completion state immediately.
      setSelectedTask((prev) =>
        prev ? { ...prev, completed: nextCompleted } : prev
      );
    }
  };

  const handleNotePress = (note) => {
    if (note.password && !unlockedNoteIds.includes(note.id)) {
      setNoteToUnlock(note);
      setShowUnlockModal(true);
      return;
    }
    setSelectedNote(note);
    setShowNoteDetailModal(true);
    setIsNoteEditing(false);
    setNoteTitleDraft(note.title || '');
    setNoteContentDraft(note.content || '');
  };

  const closeNoteDetail = () => {
    setShowNoteDetailModal(false);
    setSelectedNote(null);
    setNoteTitleDraft('');
    setNoteContentDraft('');
    setNoteBodyViewportHeight(0);
    setNoteTitleHeight(0);
    setNoteContentMeasuredHeight(0);
    setIsNoteEditing(false);
  };

  const handleDeleteNote = () => {
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
            closeNoteDetail();
          },
        },
      ]
    );
  };

  const handleSaveNote = async () => {
    if (!selectedNote) return;
    const updates = {
      title: noteTitleDraft || 'Untitled note',
      content: noteContentDraft,
    };
    await updateNote(selectedNote.id, updates);
    setSelectedNote((prev) => (prev ? { ...prev, ...updates } : prev));
    closeNoteDetail();
  };

  const handleUnlockNote = () => {
    if (!noteToUnlock) return;
    setShowUnlockModal(false);
    setShowNoteDetailModal(true);
    setSelectedNote(noteToUnlock);
    setIsNoteEditing(false);
    setNoteTitleDraft(noteToUnlock.title || '');
    setNoteContentDraft(noteToUnlock.content || '');
    setUnlockedNoteIds([...unlockedNoteIds, noteToUnlock.id]);
    setNoteToUnlock(null);
  };

  const handleSetNoteViewMode = () => {
    if (!isNoteEditing) return;
    setIsNoteEditing(false);
    Keyboard.dismiss();
  };

  const handleSetNoteEditMode = () => {
    if (isNoteEditing) return;
    setIsNoteEditing(true);
    setTimeout(() => {
      noteContentInputRef.current?.focus();
    }, 0);
  };

  const handleManageSecurity = (note) => {
    setSelectedNote(note);
    resetSecurityForm();
    setShowNoteSecurityModal(true);
  };

  useEffect(() => {
    if (selectedNote) {
      setNoteTitleDraft(selectedNote.title || '');
      setNoteContentDraft(selectedNote.content || '');
    } else {
      setNoteTitleDraft('');
      setNoteContentDraft('');
    }
  }, [selectedNote]);

  const handleSaveNotePassword = async () => {
    if (!selectedNote) return;
    setSecurityError('');

    try {
      if (selectedNote.password && !currentNotePassword) {
        setSecurityError('Enter current password to change it.');
        return;
      }
      if (!newNotePassword) {
        setSecurityError('Enter a new password.');
        return;
      }
      if (newNotePassword !== confirmNotePassword) {
        setSecurityError('New passwords do not match.');
        return;
      }

      await setNotePassword(selectedNote.id, newNotePassword, currentNotePassword);
      setShowNoteSecurityModal(false);
      setUnlockedNoteIds(unlockedNoteIds.filter((id) => id !== selectedNote.id));
    } catch (err) {
      setSecurityError(err?.message || 'Unable to update password.');
    }
  };

  const handleRemoveNotePassword = async () => {
    if (!selectedNote) return;
    setSecurityError('');
    try {
      await setNotePassword(selectedNote.id, null, currentNotePassword);
      setShowNoteSecurityModal(false);
      setUnlockedNoteIds(unlockedNoteIds.filter((id) => id !== selectedNote.id));
    } catch (err) {
      setSecurityError(err?.message || 'Unable to remove password.');
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return themeColors.danger;
      case 'medium':
        return themeColors.warning;
      case 'low':
        return themeColors.textLight;
      default:
        return themeColors.textLight;
    }
  };

  const getPriorityBadgeStyles = (priority) => {
    const color = getPriorityColor(priority);
    const isLow = priority === 'low';
    return {
      backgroundColor: isLow ? (isDark ? '#3B3F52' : '#EEF1F5') : color,
      textColor: isLow ? themeColors.textSecondary : '#FFFFFF',
    };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatListDate = (dateString) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'No date';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatISODate = (date) => date.toISOString().split('T')[0];

  const handleSelectDate = (date) => {
    setTaskDate(formatISODate(date));
  };

  const openDatePicker = () => {
    setShowTimePicker(false);
    setTimePickerTarget(null);
    setShowDatePicker(true);
  };

  const openTimePicker = (target) => {
    setShowDatePicker(false);
    setTimePickerTarget(target);
    setShowTimePicker(true);
  };

  const handleSelectTime = (value) => {
    const normalized =
      value instanceof Date
        ? formatTimeFromDate(value)
        : value;

    if (timePickerTarget === 'task') {
      setTaskTime(normalized);
    }
    if (timePickerTarget === 'sleep') {
      updateTodayHealth({ sleepTime: normalized });
    }
    if (timePickerTarget === 'wake') {
      updateTodayHealth({ wakeTime: normalized });
    }
  };

  const handleToggleTaskCompletionInline = async (taskId, evt) => {
    evt?.stopPropagation?.();
    await toggleTaskCompletion(taskId);
  };

  const handleImportCalendarEvents = async () => {
    if (calendarSyncAction) return;
    if (!userSettings?.calendarSyncEnabled) {
      Alert.alert(
        'Calendar access required',
        'Enable calendar import/export in Settings -> Permissions first.'
      );
      return;
    }

    try {
      setCalendarSyncAction('import');
      const result = await importTasksFromDeviceCalendar();
      Alert.alert(
        'Import complete',
        `Scanned ${result.scanned} events.\nImported ${result.imported} tasks.\nUpdated ${result.updated} tasks.\nSkipped ${result.skipped}.\nOverlaps detected ${result.overlaps || 0}.`
      );
    } catch (err) {
      Alert.alert('Import failed', err?.message || 'Unable to import calendar events.');
    } finally {
      setCalendarSyncAction(null);
    }
  };

  const handleExportTasksToCalendar = async () => {
    if (calendarSyncAction) return;
    if (!userSettings?.calendarSyncEnabled) {
      Alert.alert(
        'Calendar access required',
        'Enable calendar import/export in Settings -> Permissions first.'
      );
      return;
    }

    try {
      setCalendarSyncAction('export');
      const result = await exportTasksToDeviceCalendar();
      Alert.alert(
        'Export complete',
        `Processed ${result.total} tasks.\nCreated ${result.exported} events.\nUpdated ${result.updated} events.\nSkipped ${result.skipped}.`
      );
    } catch (err) {
      Alert.alert('Export failed', err?.message || 'Unable to export tasks to calendar.');
    } finally {
      setCalendarSyncAction(null);
    }
  };

  const runUndoImportedTasks = async () => {
    if (calendarSyncAction) return;
    try {
      setCalendarSyncAction('undo');
      const result = await undoImportedCalendarTasks();
      Alert.alert(
        'Undo import complete',
        `Tracked ${result.tracked} imported tasks.\nRemoved ${result.removed} tasks.\nMissing ${result.missing}.`
      );
    } catch (err) {
      Alert.alert('Undo failed', err?.message || 'Unable to undo imported calendar tasks.');
    } finally {
      setCalendarSyncAction(null);
    }
  };

  const handleUndoImportedTasks = () => {
    if (calendarSyncAction) return;
    Alert.alert(
      'Undo calendar import',
      'This removes all tasks created by calendar import from Tasks and Calendar. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Undo import', style: 'destructive', onPress: runUndoImportedTasks },
      ]
    );
  };

  const handleOpenCalendarFromArrow = () => {
    if (isCalendarTransitioning) return;
    const nextIsCalendarView = !isCalendarView;

    setIsCalendarTransitioning(true);
    Animated.timing(calendarChevronProgress, {
      toValue: nextIsCalendarView ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.timing(calendarTransitionProgress, {
      toValue: 1,
      duration: 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        setIsCalendarTransitioning(false);
        return;
      }

      setIsCalendarView(nextIsCalendarView);
      if (!nextIsCalendarView) {
        setShowCalendarSettings(false);
      }

      Animated.timing(calendarTransitionProgress, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setIsCalendarTransitioning(false));
    });
  };

  const viewContentOpacity = calendarTransitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const viewContentTranslateY = calendarTransitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });
  const chevronRotate = calendarChevronProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const chevronScale = calendarTransitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.92],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tasksTheme.background }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical
        bounces
      >
        <View style={styles.headerRow}>
          <View style={styles.headerIntro}>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>Tasks</Text>
            <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
              Plan your day and stay on track
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: tasksTheme.actionSecondaryBg,
                  borderColor: tasksTheme.actionSecondaryBorder,
                },
              ]}
              onPress={() => setShowCalendarSettings((prev) => !prev)}
              activeOpacity={0.85}
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color={tasksTheme.actionSecondaryText}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: tasksTheme.actionSecondaryBg,
                  borderColor: tasksTheme.actionSecondaryBorder,
                },
              ]}
              onPress={() => navigation.navigate('Notes')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="document-text-outline"
                size={20}
                color={tasksTheme.actionSecondaryText}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerAddButton}
              onPress={() => setShowTaskModal(true)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={tasksTheme.actionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerAddButtonGradient}
              >
                <Ionicons name="add" size={22} color={tasksTheme.actionText} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.dateSelectorHeader}>
          <TouchableOpacity onPress={goToPreviousWeek} style={styles.dateSelectorNavButton}>
            <Ionicons name="chevron-back" size={20} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.dateSelectorMonthTitle, { color: themeColors.text }]}>
            {TASK_MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </Text>
          <TouchableOpacity onPress={goToNextWeek} style={styles.dateSelectorNavButton}>
            <Ionicons name="chevron-forward" size={20} color={themeColors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekContainer}>
          {weekDays.map((day, index) => (
            <TouchableOpacity
              key={`${day.toDateString()}-${index}`}
              style={[
                styles.dayColumn,
                isSelectedDate(day) && styles.dayColumnSelected,
              ]}
              onPress={() => handleDaySelect(day)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.dayName,
                  { color: themeColors.textSecondary },
                  isSelectedDate(day) && { color: themeColors.primary },
                ]}
              >
                {TASK_WEEKDAY_LABELS[day.getDay()]}
              </Text>
              <View
                style={[
                  styles.dayNumber,
                  isToday(day) && [styles.dayNumberToday, { backgroundColor: themeColors.text }],
                  isSelectedDate(day) && [
                    styles.dayNumberSelected,
                    { backgroundColor: themeColors.primary },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.dayNumberText,
                    { color: themeColors.text },
                    (isToday(day) || isSelectedDate(day)) && styles.dayNumberTextOnAccent,
                  ]}
                >
                  {day.getDate()}
                </Text>
              </View>
              {hasTasksOnDate(day) && (
                <View style={[styles.taskIndicator, { backgroundColor: themeColors.primary }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.dateSelectorMetaRow}>
          <Text style={[styles.dateSelectorSelectedText, { color: themeColors.textSecondary }]}>
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <TouchableOpacity onPress={goToToday} activeOpacity={0.85}>
            <Text style={[styles.dateSelectorTodayText, { color: themeColors.primary }]}>Today</Text>
          </TouchableOpacity>
        </View>

        {showCalendarSettings && (
          <Card
            style={[
              styles.calendarSettingsCard,
              {
                borderColor: tasksTheme.tasksCardBorder,
                backgroundColor: tasksTheme.tasksCardBg,
              },
            ]}
          >
            <Text style={[styles.calendarSettingsTitle, { color: themeColors.text }]}>Calendar Settings</Text>
            <Text style={[styles.calendarSettingsSubtitle, { color: themeColors.textSecondary }]}>
              Import and export your calendar events with tasks.
            </Text>
            <Text style={[styles.calendarSettingsStatusText, { color: themeColors.textLight }]}>
              {userSettings?.calendarSyncEnabled
                ? 'Calendar sync is enabled.'
                : 'Enable calendar sync in Settings -> Permissions first.'}
            </Text>

            <TouchableOpacity
              style={[
                styles.calendarSettingsActionButton,
                {
                  borderColor: tasksTheme.taskItemBorder,
                  backgroundColor: tasksTheme.taskItemBg,
                },
                calendarSyncAction && styles.calendarSettingsActionDisabled,
              ]}
              onPress={handleImportCalendarEvents}
              disabled={Boolean(calendarSyncAction)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={calendarSyncAction === 'import' ? 'hourglass-outline' : 'download-outline'}
                size={18}
                color={themeColors.tasks}
              />
              <Text style={[styles.calendarSettingsActionText, { color: themeColors.tasks }]}>
                {calendarSyncAction === 'import' ? 'Importing...' : 'Import Calendar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.calendarSettingsActionButton,
                {
                  borderColor: tasksTheme.taskItemBorder,
                  backgroundColor: tasksTheme.taskItemBg,
                },
                calendarSyncAction && styles.calendarSettingsActionDisabled,
              ]}
              onPress={handleExportTasksToCalendar}
              disabled={Boolean(calendarSyncAction)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={calendarSyncAction === 'export' ? 'hourglass-outline' : 'share-outline'}
                size={18}
                color={themeColors.tasks}
              />
              <Text style={[styles.calendarSettingsActionText, { color: themeColors.tasks }]}>
                {calendarSyncAction === 'export' ? 'Exporting...' : 'Export Calendar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.calendarSettingsActionButton,
                styles.calendarSettingsDangerButton,
                calendarSyncAction && styles.calendarSettingsActionDisabled,
              ]}
              onPress={handleUndoImportedTasks}
              disabled={Boolean(calendarSyncAction)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={calendarSyncAction === 'undo' ? 'hourglass-outline' : 'trash-outline'}
                size={18}
                color={themeColors.danger}
              />
              <Text style={[styles.calendarSettingsActionText, { color: themeColors.danger }]}>
                {calendarSyncAction === 'undo' ? 'Undoing...' : 'Undo import'}
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        <TouchableOpacity
          style={styles.openCalendarChevron}
          onPress={handleOpenCalendarFromArrow}
          disabled={isCalendarTransitioning}
          activeOpacity={0.85}
        >
          <Animated.View
            style={{
              transform: [{ rotate: chevronRotate }, { scale: chevronScale }],
            }}
          >
            <Ionicons name="chevron-down" size={20} color={themeColors.textSecondary} />
          </Animated.View>
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.viewSwapContent,
            {
              opacity: viewContentOpacity,
              transform: [{ translateY: viewContentTranslateY }],
            },
          ]}
        >
          {!isCalendarView ? (
            <>
              {/* Tabs */}
              <View style={[styles.tabsRow, { borderBottomColor: tasksTheme.tabsBorder }]}>
                {tabs.map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.tab,
                      activeTab === tab && [
                        styles.tabActive,
                        { borderBottomColor: tasksTheme.tabActive },
                      ],
                    ]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        { color: tasksTheme.tabText },
                        activeTab === tab && [
                          styles.tabTextActive,
                          { color: tasksTheme.tabTextActive },
                        ],
                      ]}
                    >
                      {tab}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Filters */}
              <View style={styles.filterRow}>
                <View
                  style={[
                    styles.filterIcon,
                    {
                      backgroundColor: tasksTheme.filterIconBg,
                      borderColor: tasksTheme.filterIconBorder,
                    },
                  ]}
                >
                  <Ionicons name="filter-outline" size={18} color={tasksTheme.filterIconColor} />
                </View>
                {filters.map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: tasksTheme.filterChipBg,
                        borderColor: tasksTheme.filterChipBorder,
                      },
                      filterType === filter && [
                        styles.filterChipActive,
                        {
                          backgroundColor: tasksTheme.filterChipActiveBg,
                          borderColor: tasksTheme.filterChipActiveBorder,
                        },
                      ],
                    ]}
                    onPress={() => setFilterType(filter)}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        { color: tasksTheme.filterChipText },
                        filterType === filter && [
                          styles.filterTextActive,
                          { color: tasksTheme.filterChipTextActive },
                        ],
                      ]}
                    >
                      {filter}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {selectedDateOverlapPairs.length > 0 && (
                <Card style={[styles.overlapWarningCard, { borderColor: themeColors.warning }]}>
                  <View style={styles.overlapWarningHeader}>
                    <Ionicons name="warning-outline" size={16} color={themeColors.warning} />
                    <Text style={[styles.overlapWarningTitle, { color: themeColors.warning }]}>
                      Overlap warning
                    </Text>
                  </View>
                  <Text style={[styles.overlapWarningText, { color: themeColors.textSecondary }]}>
                    {selectedDateOverlapPairs.length} schedule conflict
                    {selectedDateOverlapPairs.length === 1 ? '' : 's'} detected.
                  </Text>
                  {selectedDateOverlapPairs.slice(0, 2).map((pair) => (
                    <Text
                      key={`${pair.a?.id || 'a'}-${pair.b?.id || 'b'}`}
                      style={[styles.overlapWarningText, { color: themeColors.textSecondary }]}
                    >
                      {pair.a?.title || 'Task'} overlaps {pair.b?.title || 'Task'} ({formatTaskTimeRangeLabel(pair.a)} vs{' '}
                      {formatTaskTimeRangeLabel(pair.b)})
                    </Text>
                  ))}
                </Card>
              )}

              {/* Tasks List */}
              <Card
                style={[
                  styles.sectionCard,
                  styles.tasksCard,
                  {
                    backgroundColor: tasksTheme.tasksCardBg,
                    borderColor: tasksTheme.tasksCardBorder,
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: tasksTheme.tasksTitle, marginBottom: 0 }]}>
                    {taskSectionTitle}
                  </Text>
                </View>
                {filteredTasks.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name="calendar-outline"
                      size={48}
                      color={tasksTheme.tasksTitle}
                    />
                    <Text style={styles.emptyTitle}>{emptyStateTitle}</Text>
                    <Text style={styles.emptySubtitle}>{emptyStateSubtitle}</Text>
                  </View>
                ) : (
                  filteredTasks.map((task) => (
                    <TouchableOpacity
                      key={task.id}
                      style={[
                        styles.taskItem,
                        {
                          backgroundColor: tasksTheme.taskItemBg,
                          borderColor: tasksTheme.taskItemBorder,
                        },
                      ]}
                      onPress={() => handleTaskPress(task)}
                      activeOpacity={0.7}
                    >
                      <TouchableOpacity
                        style={[
                          styles.checkbox,
                          {
                            borderColor: tasksTheme.taskItemBorder,
                            backgroundColor: tasksTheme.checkboxBg,
                          },
                          task.completed && styles.checkboxChecked,
                        ]}
                        onPress={() => toggleTaskCompletion(task.id)}
                      >
                        {task.completed && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                      <View style={styles.taskContent}>
                        <Text
                          style={[
                            styles.taskTitle,
                            task.completed && styles.taskTitleCompleted,
                          ]}
                          numberOfLines={1}
                        >
                          {task.title}
                        </Text>
                        <View style={styles.taskMeta}>
                          {(() => {
                            const badge = getPriorityBadgeStyles(task.priority);
                            return (
                              <View
                                style={[
                                  styles.priorityBadge,
                                  { backgroundColor: badge.backgroundColor },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.priorityText,
                                    { color: badge.textColor },
                                  ]}
                                >
                                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                </Text>
                              </View>
                            );
                          })()}
                          <Text style={[styles.taskDate, { color: tasksTheme.taskDate }]}>
                            {formatDate(task.date)} | {formatTaskTimeRangeLabel(task)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </Card>
            </>
          ) : (
            <>
              <Card
                style={[
                  styles.sectionCard,
                  styles.tasksCard,
                  {
                    backgroundColor: tasksTheme.tasksCardBg,
                    borderColor: tasksTheme.tasksCardBorder,
                  },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: tasksTheme.tasksTitle }]}>Day Timeline</Text>
                {timeSlots.map((time) => {
                  const slotHour = parseInt(time.split(':')[0], 10);
                  const tasksAtTime = selectedDateTasks.filter((task) => {
                    const parsed = parseHour(task.time);
                    return parsed?.hour === slotHour;
                  });

                  return (
                    <View key={time} style={[styles.calendarTimelineSlot, { borderBottomColor: tasksTheme.taskItemBorder }]}>
                      <Text style={[styles.calendarTimelineLabel, { color: themeColors.textLight }]}>{time}</Text>
                      <View style={styles.calendarTimelineSlotContent}>
                        {tasksAtTime.map((task) => (
                          <View
                            key={task.id}
                            style={[
                              styles.calendarTimelineTask,
                              {
                                borderLeftColor: getPriorityColor(task.priority),
                                backgroundColor: tasksTheme.taskItemBg,
                              },
                            ]}
                          >
                            <TouchableOpacity onPress={() => handleTaskPress(task)} activeOpacity={0.8}>
                              <Text style={[styles.calendarTimelineTaskTitle, { color: themeColors.text }]} numberOfLines={1}>
                                {task.title}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.calendarInlineCompleteButton,
                                task.completed && styles.calendarInlineCompleteButtonDone,
                              ]}
                              onPress={(evt) => handleToggleTaskCompletionInline(task.id, evt)}
                              activeOpacity={0.85}
                            >
                              <Text
                                style={[
                                  styles.calendarInlineCompleteButtonText,
                                  task.completed && { color: themeColors.success },
                                ]}
                              >
                                {task.completed ? 'Done' : 'Complete'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </Card>

              <Card
                style={[
                  styles.sectionCard,
                  styles.tasksCard,
                  {
                    backgroundColor: tasksTheme.tasksCardBg,
                    borderColor: tasksTheme.tasksCardBorder,
                  },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: tasksTheme.tasksTitle }]}>Upcoming Tasks</Text>
                {upcomingDatedTasks.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="calendar-outline" size={32} color={tasksTheme.tasksTitle} />
                    <Text style={styles.emptyText}>No upcoming tasks</Text>
                  </View>
                ) : (
                  upcomingDatedTasks.map((task) => (
                    <View key={task.id} style={[styles.calendarListTaskItem, { borderBottomColor: tasksTheme.taskItemBorder }]}>
                      <View style={styles.calendarListTaskInfo}>
                        <Text style={[styles.taskTitle, { color: themeColors.text }]} numberOfLines={1}>
                          {task.title}
                        </Text>
                        <Text style={[styles.calendarListTaskMeta, { color: themeColors.textSecondary }]}>
                          {formatListDate(task.date)}
                          {task.time ? ` | ${formatTaskTimeRangeLabel(task)}` : ''}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.priorityBadge,
                          { backgroundColor: `${getPriorityColor(task.priority)}20` },
                        ]}
                      >
                        <Text style={[styles.priorityText, { color: getPriorityColor(task.priority) }]}>
                          {task.priority || 'none'}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </Card>
            </>
          )}
        </Animated.View>

      </PlatformScrollView>

        {/* Add Task Modal */}
        <Modal
          visible={showTaskModal}
          onClose={closeTaskModal}
          fullScreen
          hideHeader
          showCloseButton={false}
          contentStyle={{ paddingHorizontal: 0 }}
        >
          <View
            style={[
              styles.taskFormScreen,
              {
                backgroundColor: tasksTheme.background,
                paddingTop: insets.top + spacing.sm,
              },
            ]}
          >
            <View style={styles.taskFormTop}>
              <TouchableOpacity
                style={[
                  styles.taskFormIconButton,
                  {
                    borderColor: tasksTheme.actionSecondaryBorder,
                    backgroundColor: tasksTheme.actionSecondaryBg,
                  },
                ]}
                onPress={closeTaskModal}
              >
                <Ionicons name="chevron-back" size={20} color={themeColors.text} />
              </TouchableOpacity>
              <Text style={[styles.taskFormTitle, { color: themeColors.text }]}>New Task</Text>
              <View style={styles.taskFormSpacer} />
            </View>

            <PlatformScrollView
              style={styles.taskFormScroll}
              contentContainerStyle={styles.taskFormBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[
                  styles.taskFormSectionCard,
                  {
                    borderColor: tasksTheme.tasksCardBorder,
                    backgroundColor: tasksTheme.tasksCardBg,
                  },
                ]}
              >
                <TextInput
                  style={[
                    styles.taskFormInput,
                    {
                      borderColor: tasksTheme.taskItemBorder,
                      color: themeColors.text,
                      backgroundColor: tasksTheme.taskItemBg,
                    },
                  ]}
                  placeholder="Task title"
                  placeholderTextColor={themeColors.textLight}
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                />
                <TextInput
                  style={[
                    styles.taskFormInput,
                    styles.taskFormTextArea,
                    {
                      borderColor: tasksTheme.taskItemBorder,
                      color: themeColors.text,
                      backgroundColor: tasksTheme.taskItemBg,
                      marginBottom: 0,
                    },
                  ]}
                  placeholder="Description (optional)"
                  placeholderTextColor={themeColors.textLight}
                  value={taskDescription}
                  onChangeText={setTaskDescription}
                  multiline
                />
              </View>

              <View
                style={[
                  styles.taskFormSectionCard,
                  {
                    borderColor: tasksTheme.tasksCardBorder,
                    backgroundColor: tasksTheme.tasksCardBg,
                  },
                ]}
              >
                <Text style={[styles.taskFormSectionTitle, { color: themeColors.text }]}>Sharing</Text>
                <TouchableOpacity
                  style={styles.taskFormRowLine}
                  onPress={() => setShowGroupPicker((prev) => !prev)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.taskFormRowLabel, { color: themeColors.text }]}>Share with group</Text>
                  <Text style={[styles.taskFormRowValue, { color: themeColors.textSecondary }]}>
                    {selectedGroup?.name || 'None'}
                  </Text>
                </TouchableOpacity>
                {showGroupPicker ? (
                  <View
                    style={[
                      styles.taskFormInlineSheet,
                      {
                        borderColor: tasksTheme.taskItemBorder,
                        backgroundColor: tasksTheme.taskItemBg,
                      },
                    ]}
                  >
                    {!groups.length ? (
                      <Text style={[styles.taskFormShareHint, { color: themeColors.textLight }]}>
                        No groups yet. Create one in the Groups area.
                      </Text>
                    ) : (
                      (groups || []).map((group) => {
                        const selected = selectedGroupId === group.id;
                        const memberCount = (group.members || []).length;
                        return (
                          <View key={group.id} style={styles.taskFormFriendRow}>
                            <View style={styles.taskFormFriendTextWrap}>
                              <Text style={[styles.taskFormFriendName, { color: themeColors.text }]} numberOfLines={1}>
                                {group.name || 'Group'}
                              </Text>
                              <Text style={[styles.taskFormFriendUser, { color: themeColors.textSecondary }]} numberOfLines={1}>
                                {memberCount} {memberCount === 1 ? 'member' : 'members'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[
                                styles.taskFormFriendAction,
                                {
                                  borderColor: selected ? themeColors.tasks : tasksTheme.taskItemBorder,
                                  backgroundColor: selected ? themeColors.tasks : tasksTheme.tasksCardBg,
                                },
                              ]}
                              onPress={() => toggleSelectedGroup(group.id)}
                              activeOpacity={0.85}
                            >
                              <Text
                                style={[
                                  styles.taskFormFriendActionText,
                                  { color: selected ? '#FFFFFF' : themeColors.textSecondary },
                                ]}
                              >
                                {selected ? 'Selected' : 'Select'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    )}
                    <Text style={[styles.taskFormShareHint, { color: themeColors.textSecondary }]}>
                      Group sharing creates this task for all members immediately.
                    </Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={styles.taskFormRowLine}
                  onPress={() => setShowPeopleModal((prev) => !prev)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.taskFormRowLabel, { color: themeColors.text }]}>Invite friends</Text>
                  <Text style={[styles.taskFormRowValue, { color: themeColors.textSecondary }]}>
                    {invitedFriendIds.length ? `${invitedFriendIds.length} selected` : 'None'}
                  </Text>
                </TouchableOpacity>
                {showPeopleModal ? (
                  <View
                    style={[
                      styles.taskFormInlineSheet,
                      {
                        borderColor: tasksTheme.taskItemBorder,
                        backgroundColor: tasksTheme.taskItemBg,
                      },
                    ]}
                  >
                    {!friends.length ? (
                      <Text style={[styles.taskFormShareHint, { color: themeColors.textLight }]}>No friends to invite yet.</Text>
                    ) : (
                      (friends || []).map((friend) => {
                        const invited = invitedFriendIds.includes(friend.id);
                        return (
                          <View key={friend.id} style={styles.taskFormFriendRow}>
                            <View style={styles.taskFormFriendTextWrap}>
                              <Text style={[styles.taskFormFriendName, { color: themeColors.text }]} numberOfLines={1}>
                                {friend.name || friend.username || 'Friend'}
                              </Text>
                              <Text style={[styles.taskFormFriendUser, { color: themeColors.textSecondary }]} numberOfLines={1}>
                                {friend.username ? `@${friend.username}` : ''}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[
                                styles.taskFormFriendAction,
                                {
                                  borderColor: invited ? themeColors.tasks : tasksTheme.taskItemBorder,
                                  backgroundColor: invited ? themeColors.tasks : tasksTheme.tasksCardBg,
                                },
                              ]}
                              onPress={() => toggleInvitedFriend(friend.id)}
                              activeOpacity={0.85}
                            >
                              <Text
                                style={[
                                  styles.taskFormFriendActionText,
                                  { color: invited ? '#FFFFFF' : themeColors.textSecondary },
                                ]}
                              >
                                {invited ? 'Invited' : 'Invite'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    )}
                    <Text style={[styles.taskFormShareHint, { color: themeColors.textSecondary }]}>
                      Invites are sent when you create the task.
                    </Text>
                  </View>
                ) : null}
              </View>

              <View
                style={[
                  styles.taskFormSectionCard,
                  {
                    borderColor: tasksTheme.tasksCardBorder,
                    backgroundColor: tasksTheme.tasksCardBg,
                  },
                ]}
              >
                <Text style={[styles.taskFormSectionTitle, { color: themeColors.text }]}>Category</Text>
                <View style={styles.taskFormPriorityRow}>
                  {TASK_CATEGORY_OPTIONS.map((option, index) => {
                    const selected = taskCategory === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.taskFormPriorityOption,
                          index === TASK_CATEGORY_OPTIONS.length - 1 && styles.taskFormPriorityOptionLast,
                          {
                            backgroundColor: selected ? themeColors.tasks : tasksTheme.taskItemBg,
                            borderColor: selected ? themeColors.tasks : tasksTheme.taskItemBorder,
                          },
                        ]}
                        onPress={() => setTaskCategory(option.value)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.taskFormPriorityText,
                            { color: selected ? '#FFFFFF' : themeColors.textSecondary },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.taskFormSectionTitle, { color: themeColors.text }]}>Priority</Text>
                <View style={styles.taskFormPriorityRow}>
                  {priorityLevels.map((level, index) => {
                    const selected = taskPriority === level.value;
                    return (
                      <TouchableOpacity
                        key={level.value}
                        style={[
                          styles.taskFormPriorityOption,
                          index === priorityLevels.length - 1 && styles.taskFormPriorityOptionLast,
                          {
                            backgroundColor: selected ? level.color : tasksTheme.taskItemBg,
                            borderColor: selected ? level.color : tasksTheme.taskItemBorder,
                          },
                        ]}
                        onPress={() => setTaskPriority(level.value)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.taskFormPriorityText, { color: selected ? '#FFFFFF' : themeColors.textSecondary }]}>
                          {level.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.taskFormDateTimeRow}>
                  <View style={[styles.taskFormDateField, styles.taskFormDateFieldGap]}>
                    <Text style={[styles.taskFormDateLabel, { color: themeColors.textSecondary }]}>Date</Text>
                    <TouchableOpacity
                      style={[
                        styles.taskFormDateButton,
                        {
                          borderColor: tasksTheme.taskItemBorder,
                          backgroundColor: tasksTheme.taskItemBg,
                        },
                      ]}
                      onPress={openDatePicker}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.taskFormDateButtonText, { color: themeColors.text }]}>{formatDate(taskDate)}</Text>
                      <Ionicons name="calendar-outline" size={18} color={themeColors.textLight} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.taskFormDateField}>
                    <Text style={[styles.taskFormDateLabel, { color: themeColors.textSecondary }]}>Time</Text>
                    <TouchableOpacity
                      style={[
                        styles.taskFormDateButton,
                        {
                          borderColor: tasksTheme.taskItemBorder,
                          backgroundColor: tasksTheme.taskItemBg,
                        },
                      ]}
                      onPress={() => openTimePicker('task')}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.taskFormDateButtonText,
                          !taskTime && styles.taskFormPlaceholderText,
                        ]}
                      >
                        {taskTime || 'Select time'}
                      </Text>
                      <Ionicons name="time-outline" size={18} color={themeColors.textLight} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.taskFormDurationRow}>
                  <Text style={[styles.taskFormDateLabel, { color: themeColors.textSecondary }]}>
                    Duration
                  </Text>
                  <View
                    style={[
                      styles.taskFormDurationInputWrap,
                      {
                        borderColor: tasksTheme.taskItemBorder,
                        backgroundColor: tasksTheme.taskItemBg,
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.taskFormDurationInput, { color: themeColors.text }]}
                      value={taskDurationInput}
                      onChangeText={handleTaskDurationChange}
                      onBlur={() =>
                        setTaskDurationInput(String(normalizedTaskDurationMinutes))
                      }
                      keyboardType="number-pad"
                      placeholder={String(DEFAULT_TASK_DURATION_MINUTES)}
                      placeholderTextColor={themeColors.placeholder}
                      maxLength={4}
                    />
                    <Text style={[styles.taskFormDurationUnit, { color: themeColors.textSecondary }]}>
                      min
                    </Text>
                  </View>
                </View>

                <Text style={[styles.quickLabel, { color: themeColors.textSecondary }]}>Quick durations</Text>
                <View style={styles.quickGroup}>
                  {TASK_QUICK_DURATIONS.map((duration) => {
                    const selected = normalizedTaskDurationMinutes === duration;
                    return (
                      <TouchableOpacity
                        key={duration}
                        style={[
                          styles.quickChip,
                          {
                            backgroundColor: selected ? themeColors.tasks : tasksTheme.taskItemBg,
                            borderColor: selected ? themeColors.tasks : tasksTheme.taskItemBorder,
                          },
                        ]}
                        onPress={() => handleQuickTaskDuration(duration)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            { color: selected ? '#FFFFFF' : themeColors.textSecondary },
                          ]}
                        >
                          {duration}m
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {taskTime ? (
                  <Text style={[styles.taskFormDurationSummary, { color: themeColors.textSecondary }]}>
                    Schedule: {formatTaskTimeRangeLabel({
                      date: taskDate,
                      time: taskTime,
                      durationMinutes: normalizedTaskDurationMinutes,
                    })}
                  </Text>
                ) : null}

                <Text style={[styles.quickLabel, { color: themeColors.textSecondary }]}>Quick dates</Text>
                <View style={styles.quickGroup}>
                  {TASK_QUICK_DATES.map((option) => {
                    const quickDate = getISODateWithOffset(option.offset);
                    const selected = taskDate === quickDate;
                    return (
                      <TouchableOpacity
                        key={option.label}
                        style={[
                          styles.quickChip,
                          {
                            backgroundColor: selected ? themeColors.tasks : tasksTheme.taskItemBg,
                            borderColor: selected ? themeColors.tasks : tasksTheme.taskItemBorder,
                          },
                        ]}
                        onPress={() => handleQuickTaskDate(option.offset)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            { color: selected ? '#FFFFFF' : themeColors.textSecondary },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.quickLabel, { color: themeColors.textSecondary }]}>Quick times</Text>
                <View style={[styles.quickGroup, { marginBottom: 0 }]}>
                  {TASK_QUICK_TIMES.map((time) => {
                    const selected = normalizedTaskTime === time;
                    return (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.quickChip,
                          {
                            backgroundColor: selected ? themeColors.tasks : tasksTheme.taskItemBg,
                            borderColor: selected ? themeColors.tasks : tasksTheme.taskItemBorder,
                          },
                        ]}
                        onPress={() => handleQuickTaskTime(time)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            { color: selected ? '#FFFFFF' : themeColors.textSecondary },
                          ]}
                        >
                          {time}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {taskTime && draftTaskOverlaps.length > 0 ? (
                  <View
                    style={[
                      styles.taskFormConflictBox,
                      {
                        borderColor: themeColors.warning,
                        backgroundColor: `${themeColors.warning}14`,
                      },
                    ]}
                  >
                    <Ionicons name="warning-outline" size={16} color={themeColors.warning} />
                    <Text style={[styles.taskFormConflictText, { color: themeColors.textSecondary }]}>
                      Overlaps with {draftTaskOverlaps.length} existing task
                      {draftTaskOverlaps.length === 1 ? '' : 's'}.
                    </Text>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={[
                  styles.taskFormSaveButton,
                  {
                    backgroundColor:
                      taskTitle.trim() && taskTime && !invitingFriends
                        ? themeColors.tasks
                        : tasksTheme.actionSecondaryBorder,
                  },
                ]}
                onPress={handleCreateTask}
                disabled={!taskTitle.trim() || !taskTime || invitingFriends}
                activeOpacity={0.85}
              >
                <Text style={styles.taskFormSaveButtonText}>{invitingFriends ? 'Creating...' : 'Create task'}</Text>
              </TouchableOpacity>
            </PlatformScrollView>

            <PlatformDatePicker
              visible={showDatePicker}
              value={taskDate}
              onChange={handleSelectDate}
              onClose={() => setShowDatePicker(false)}
              accentColor={themeColors.tasks}
            />

            <PlatformTimePicker
              visible={showTimePicker}
              value={
                timePickerTarget === 'task'
                  ? taskTime
                  : timePickerTarget === 'sleep'
                  ? todayHealth?.sleepTime
                  : timePickerTarget === 'wake'
                  ? todayHealth?.wakeTime
                  : ''
              }
              onChange={handleSelectTime}
              onClose={() => {
                setShowTimePicker(false);
                setTimePickerTarget(null);
              }}
              options={timeOptions}
              accentColor={themeColors.tasks}
            />
          </View>
        </Modal>

      {/* Quick Note Modal */}
      <Modal
        visible={showNoteModal}
        onClose={() => {
          setShowNoteModal(false);
          resetNoteForm();
        }}
        title="New Note"
        fullScreen
      >
        <View style={styles.noteForm}>
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setShowNoteModal(false);
                resetNoteForm();
              }}
              style={styles.modalButton}
            />
            <Button
              title="Create"
              onPress={handleCreateNote}
              disabled={!noteTitle.trim()}
              style={styles.modalButton}
            />
          </View>

          <Input
            value={noteTitle}
            onChangeText={setNoteTitle}
            placeholder="Title"
            style={styles.noteFieldContainer}
            inputStyle={styles.noteFieldInput}
            containerStyle={styles.noteFieldWrapper}
          />

          <Input
            value={noteContent}
            onChangeText={setNoteContent}
            placeholder="Start writing..."
            multiline
            numberOfLines={16}
            style={styles.noteFieldContainer}
            inputStyle={[styles.noteContentInput, styles.noteFieldInput]}
            containerStyle={styles.noteContentWrapper}
          />
        </View>
        </Modal>

        {/* Task Detail Modal */}
        <Modal
          visible={showTaskDetailModal}
          onClose={() => {
            setShowTaskDetailModal(false);
            setSelectedTask(null);
          }}
          title="Task Details"
          fullScreen
        >
        {selectedTask && (
          <>
            <Text style={styles.detailTitle}>{selectedTask.title}</Text>
            {(() => {
              const badge = getPriorityBadgeStyles(selectedTask.priority);
              return (
                <View
                  style={[
                    styles.priorityBadgeLarge,
                    { backgroundColor: badge.backgroundColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityTextLarge,
                      { color: badge.textColor },
                    ]}
                  >
                {selectedTask.priority.charAt(0).toUpperCase() +
                  selectedTask.priority.slice(1)}{' '}
                Priority
                  </Text>
                </View>
              );
            })()}

            {selectedTask.description && (
              <>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailDescription}>
                  {selectedTask.description}
                </Text>
              </>
            )}

            <Text style={styles.detailLabel}>People</Text>
            {loadingTaskPeople ? (
              <Text style={styles.peopleLoadingText}>Loading…</Text>
            ) : taskPeople.length ? (
              <View style={styles.peoplePills}>
                {taskPeople.map((p) => (
                  <View key={p.id} style={styles.peoplePill}>
                    <Text style={styles.peoplePillText}>
                      {p.name || (p.username ? `@${p.username}` : 'User')}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.peopleLoadingText}>Just you</Text>
            )}

            <View style={styles.scheduleBox}>
              <Ionicons name="calendar" size={20} color={themeColors.info} />
              <View style={styles.scheduleContent}>
                <Text style={styles.scheduleLabel}>Scheduled</Text>
                <Text style={styles.scheduleValue}>
                  {formatDate(selectedTask.date)} | {formatTaskTimeRangeLabel(selectedTask)}
                </Text>
              </View>
            </View>

            <View style={styles.detailButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setShowTaskDetailModal(false);
                  setSelectedTask(null);
                }}
                style={styles.detailButton}
              />
              <Button
                title="Delete"
                variant="danger"
                icon="trash-outline"
                onPress={handleDeleteTask}
                style={styles.detailButton}
              />
            </View>

            <Button
              title={selectedTask.completed ? 'Mark Uncomplete' : 'Mark Complete'}
              variant={selectedTask.completed ? 'danger' : 'success'}
              icon={selectedTask.completed ? 'close' : 'checkmark'}
              onPress={handleCompleteTask}
              style={styles.completeButton}
            />
          </>
        )}
        </Modal>

        {/* Note Detail Modal */}
        <Modal
          visible={showNoteDetailModal}
          onClose={closeNoteDetail}
          title=""
          fullScreen
          hideHeader
          showCloseButton={false}
          scrollEnabled={false}
        >
        {selectedNote && (
          <View style={styles.noteDetailContainer}>
            <View
              style={[
                styles.noteDetailHeader,
                { paddingTop: Math.max(insets.top, spacing.sm) },
              ]}
            >
              <TouchableOpacity
                onPress={closeNoteDetail}
                style={[styles.noteHeaderButton, styles.noteHeaderBackButton]}
                accessibilityLabel="Close note"
              >
                <Ionicons name="chevron-back" size={20} color={themeColors.text} />
              </TouchableOpacity>
              <View style={styles.noteHeaderActions}>
                <TouchableOpacity
                  onPress={isNoteEditing ? handleSetNoteViewMode : handleSetNoteEditMode}
                  style={styles.noteModeToggleButton}
                  accessibilityLabel={
                    isNoteEditing ? 'Switch to view mode' : 'Switch to edit mode'
                  }
                >
                  <Text style={styles.noteModeToggleText}>
                    {isNoteEditing ? 'View' : 'Edit'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteNote}
                  style={[styles.noteHeaderButton, styles.noteDeleteButton]}
                  accessibilityLabel="Delete note"
                >
                  <Ionicons name="trash-outline" size={19} color={themeColors.danger} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveNote}
                  style={[styles.noteHeaderButton, styles.noteDoneButton]}
                  accessibilityLabel="Save note"
                >
                  <Ionicons name="checkmark" size={20} color={themeColors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <PlatformScrollView
              style={styles.noteEditBody}
              contentContainerStyle={styles.noteEditBodyContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              keyboardAutoScrollEnabled={false}
              showsVerticalScrollIndicator={false}
              onLayout={(event) =>
                setNoteBodyViewportHeight(event?.nativeEvent?.layout?.height || 0)
              }
            >
              {isNoteEditing ? (
                <>
                  <TextInput
                    value={noteTitleDraft}
                    onChangeText={setNoteTitleDraft}
                    placeholder="Title"
                    placeholderTextColor={themeColors.textSecondary}
                    style={styles.noteEditTitle}
                    onLayout={(event) =>
                      setNoteTitleHeight(event?.nativeEvent?.layout?.height || 0)
                    }
                  />
                  <TextInput
                    ref={noteContentInputRef}
                    value={noteContentDraft}
                    onChangeText={setNoteContentDraft}
                    placeholder="Start writing..."
                    placeholderTextColor={themeColors.textSecondary}
                    style={[
                      styles.noteEditContent,
                      {
                        minHeight: noteContentMinHeight,
                        height: noteContentHeight,
                      },
                    ]}
                    multiline
                    textAlignVertical="top"
                    scrollEnabled={false}
                    onContentSizeChange={(event) => {
                      const nextHeight = event?.nativeEvent?.contentSize?.height || 0;
                      if (Math.abs(nextHeight - noteContentMeasuredHeight) > 1) {
                        setNoteContentMeasuredHeight(nextHeight);
                      }
                    }}
                  />
                </>
              ) : (
                <View style={styles.noteReadModeContainer}>
                  <Text style={styles.noteEditTitle}>
                    {noteTitleDraft?.trim() ? noteTitleDraft : 'Untitled note'}
                  </Text>
                  <Text
                    style={[
                      styles.noteReadContent,
                      !noteContentDraft?.trim() && styles.noteReadContentEmpty,
                    ]}
                  >
                    {noteContentDraft?.trim()
                      ? noteContentDraft
                      : 'No content yet.'}
                  </Text>
                </View>
              )}
            </PlatformScrollView>
          </View>
        )}
        </Modal>

        {/* Note Security Modal */}
        <Modal
          visible={showNoteSecurityModal}
          onClose={() => {
            setShowNoteSecurityModal(false);
            resetSecurityForm();
          }}
          title="Note Security"
          fullScreen
        >
        {selectedNote && (
          <>
            <Text style={styles.inputLabel}>Note</Text>
            <Text style={styles.detailTitle}>{selectedNote.title}</Text>
            <View style={styles.securitySection}>
              {selectedNote.password && (
                <Input
                  label="Current Password"
                  value={currentNotePassword}
                  onChangeText={setCurrentNotePassword}
                  secureTextEntry
                  placeholder="Enter current password"
                />
              )}
              <Input
                label="New Password"
                value={newNotePassword}
                onChangeText={setNewNotePassword}
                secureTextEntry
                placeholder="Enter new password"
              />
              <Input
                label="Confirm New Password"
                value={confirmNotePassword}
                onChangeText={setConfirmNotePassword}
                secureTextEntry
                placeholder="Re-enter new password"
              />
              {securityError ? (
                <Text style={styles.errorText}>{securityError}</Text>
              ) : null}
              <View style={styles.modalButtons}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setShowNoteSecurityModal(false);
                    resetSecurityForm();
                  }}
                  style={styles.modalButton}
                />
                <Button
                  title="Save Password"
                  onPress={handleSaveNotePassword}
                  style={styles.modalButton}
                />
              </View>
              {selectedNote.password && (
                <Button
                  title="Remove Password"
                  variant="outline"
                  onPress={handleRemoveNotePassword}
                />
              )}
            </View>
          </>
        )}
        </Modal>

        {/* Unlock Modal */}
        <Modal
          visible={showUnlockModal}
          onClose={() => {
            setShowUnlockModal(false);
            setNoteToUnlock(null);
            setCurrentNotePassword('');
            setSecurityError('');
          }}
          title="Unlock Note"
        >
        {noteToUnlock && (
          <>
            <Text style={styles.detailTitle}>{noteToUnlock.title}</Text>
            <Input
              label="Password"
              value={currentNotePassword}
              onChangeText={setCurrentNotePassword}
              secureTextEntry
              placeholder="Enter password"
            />
            {securityError ? (
              <Text style={styles.errorText}>{securityError}</Text>
            ) : null}
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setShowUnlockModal(false);
                  setNoteToUnlock(null);
                  setCurrentNotePassword('');
                  setSecurityError('');
                }}
                style={styles.modalButton}
              />
              <Button
                title="Unlock"
                onPress={() => {
                  if (!verifyNotePassword(noteToUnlock.id, currentNotePassword)) {
                    setSecurityError('Incorrect password.');
                    return;
                  }
                  setSecurityError('');
                  handleUnlockNote();
                  setCurrentNotePassword('');
                }}
                style={styles.modalButton}
              />
            </View>
          </>
        )}
        </Modal>

      </View>
  );
};

const createStyles = (themeColors) => {
  const isAndroid = Platform.OS === 'android';
  const backgroundColor = (themeColors && themeColors.background) || colors.background;
  const textColor = (themeColors && themeColors.text) || colors.text;

  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isAndroid ? '#ECE6DC' : themeColors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: isAndroid ? spacing.sm : spacing.xl,
    paddingBottom: 100,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: isAndroid ? 'flex-start' : 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: isAndroid ? spacing.sm : spacing.md,
  },
  headerIntro: {
    flex: 1,
    marginRight: isAndroid ? spacing.sm : spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: isAndroid ? 'flex-start' : 'center',
    marginRight: isAndroid ? 0 : -spacing.xs,
  },
  headerIconButton: {
    width: isAndroid ? 34 : 42,
    height: isAndroid ? 34 : 42,
    borderRadius: isAndroid ? 2 : 21,
    borderWidth: isAndroid ? 2 : 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isAndroid ? spacing.xs : spacing.sm,
  },
  headerAddButton: {
    width: isAndroid ? 36 : 42,
    height: isAndroid ? 36 : 42,
    borderRadius: isAndroid ? 2 : 21,
    overflow: 'hidden',
    ...(isAndroid ? {} : shadows.small),
  },
  headerAddButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    ...typography.h1,
    fontSize: isAndroid ? 24 : 34,
    fontWeight: '700',
    textTransform: isAndroid ? 'uppercase' : 'none',
    letterSpacing: isAndroid ? 1.2 : 0,
  },
  pageSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
    fontSize: isAndroid ? 12 : typography.bodySmall.fontSize,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  actionPrimary: {
    flex: 1,
    minWidth: 140,
    height: 48,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionPrimaryGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  actionPrimaryText: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  actionSecondary: {
    flex: 1,
    minWidth: 140,
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  actionSecondaryText: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  calendarButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  dateSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dateSelectorNavButton: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSelectorMonthTitle: {
    ...typography.h3,
  },
  weekContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginHorizontal: 2,
    borderRadius: borderRadius.md,
  },
  dayColumnSelected: {
    backgroundColor: `${themeColors.primary}1A`,
  },
  dayName: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  dayNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberToday: {
    backgroundColor: themeColors.text,
  },
  dayNumberSelected: {
    backgroundColor: themeColors.primary,
  },
  dayNumberText: {
    ...typography.body,
    fontWeight: '600',
  },
  dayNumberTextOnAccent: {
    color: '#FFFFFF',
  },
  taskIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: spacing.xs,
  },
  dateSelectorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dateSelectorSelectedText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  dateSelectorTodayText: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  openCalendarChevron: {
    alignSelf: 'center',
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  calendarSettingsCard: {
    marginBottom: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  calendarSettingsTitle: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  calendarSettingsSubtitle: {
    ...typography.bodySmall,
  },
  calendarSettingsStatusText: {
    ...typography.caption,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  calendarSettingsActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  calendarSettingsActionDisabled: {
    opacity: 0.6,
  },
  calendarSettingsActionText: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  calendarSettingsDangerButton: {
    borderColor: `${themeColors.danger}55`,
    backgroundColor: `${themeColors.danger}10`,
  },
  viewSwapContent: {
    flex: 1,
  },
  calendarTimelineSlot: {
    flexDirection: 'row',
    minHeight: 44,
    borderBottomWidth: 1,
  },
  calendarTimelineLabel: {
    width: 50,
    ...typography.caption,
    paddingTop: spacing.sm,
  },
  calendarTimelineSlotContent: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  calendarTimelineTask: {
    borderLeftWidth: 3,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  calendarTimelineTaskTitle: {
    ...typography.bodySmall,
  },
  calendarInlineCompleteButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: `${themeColors.primary}1A`,
    alignSelf: 'flex-start',
  },
  calendarInlineCompleteButtonDone: {
    backgroundColor: `${themeColors.success}22`,
  },
  calendarInlineCompleteButtonText: {
    ...typography.caption,
    color: themeColors.primary,
    fontWeight: '700',
  },
  calendarListTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  calendarListTaskInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  calendarListTaskMeta: {
    ...typography.caption,
  },
  tabsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
  },
  tab: {
    marginRight: spacing.lg,
    paddingBottom: spacing.sm,
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    ...typography.body,
  },
  tabTextActive: {
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  filterIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginLeft: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterChipActive: {
    borderWidth: 1,
  },
  filterText: {
    ...typography.bodySmall,
  },
  filterTextActive: {
    fontWeight: '600',
  },
  overlapWarningCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  overlapWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  overlapWarningTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
  overlapWarningText: {
    ...typography.caption,
    marginBottom: 4,
  },
  sectionCard: {
    marginBottom: isAndroid ? spacing.sm : spacing.lg,
    borderRadius: isAndroid ? 2 : borderRadius.xl,
    borderWidth: isAndroid ? 2 : 1,
    overflow: 'hidden',
  },
  tasksCard: {
    marginBottom: isAndroid ? spacing.sm : spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: isAndroid ? spacing.sm : spacing.md,
    fontSize: isAndroid ? 16 : typography.h3.fontSize,
    textTransform: isAndroid ? 'uppercase' : 'none',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  linkText: {
    ...typography.bodySmall,
    color: themeColors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: themeColors.textSecondary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: themeColors.textLight,
    marginTop: spacing.xs,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: themeColors.success,
    borderColor: themeColors.success,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    ...typography.body,
    marginBottom: spacing.xs,
    color: themeColors.text,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: themeColors.textLight,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskDate: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  notesCard: {
    marginBottom: spacing.xxxl,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    flex: 1,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  noteIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteTitle: {
    flex: 1,
    ...typography.body,
    color: themeColors.text,
  },
  noteInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  lockBadgeText: {
    ...typography.caption,
    marginLeft: spacing.xs,
  },
  createNoteEmptyButton: {
    marginTop: spacing.lg,
  },
  lockButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: themeColors.border,
    marginLeft: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteForm: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingBottom: spacing.xl,
    backgroundColor,
    borderColor: backgroundColor,
    borderWidth: 1,
  },
  noteFieldWrapper: {
    marginBottom: spacing.xs,
  },
  noteContentWrapper: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  noteFieldContainer: {
    backgroundColor,
    borderWidth: 0,
    borderColor: backgroundColor,
    paddingHorizontal: 0,
  },
  noteFieldInput: {
    paddingVertical: spacing.md,
    color: textColor,
  },
  addNewButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  addNewText: {
    ...typography.body,
    fontWeight: '700',
  },
  inputLabel: {
    ...typography.label,
    color: themeColors.text,
    marginBottom: spacing.sm,
  },
  taskFormScreen: {
    flex: 1,
  },
  taskFormTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  taskFormIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskFormTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  taskFormSpacer: {
    width: 38,
    height: 38,
  },
  taskFormScroll: {
    flex: 1,
  },
  taskFormBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  taskFormSectionCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  taskFormSectionTitle: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  taskFormInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...typography.body,
    marginBottom: spacing.sm,
  },
  taskFormTextArea: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  taskFormRowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(120,120,120,0.25)',
  },
  taskFormRowLabel: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  taskFormRowValue: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  taskFormInlineSheet: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  taskFormFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  taskFormFriendTextWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  taskFormFriendName: {
    ...typography.body,
    fontWeight: '600',
  },
  taskFormFriendUser: {
    ...typography.caption,
    marginTop: 2,
  },
  taskFormFriendAction: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  taskFormFriendActionText: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  taskFormShareHint: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  taskFormPriorityRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  taskFormPriorityOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  taskFormPriorityOptionLast: {
    marginRight: 0,
  },
  taskFormPriorityText: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  taskFormDateTimeRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  taskFormDurationRow: {
    marginBottom: spacing.md,
  },
  taskFormDurationInputWrap: {
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  taskFormDurationInput: {
    ...typography.body,
    flex: 1,
    paddingVertical: 0,
  },
  taskFormDurationUnit: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  taskFormDurationSummary: {
    ...typography.caption,
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  taskFormDateField: {
    flex: 1,
  },
  taskFormDateFieldGap: {
    marginRight: spacing.sm,
  },
  taskFormDateLabel: {
    ...typography.bodySmall,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  taskFormDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  taskFormDateButtonText: {
    ...typography.body,
    color: themeColors.text,
  },
  taskFormPlaceholderText: {
    color: themeColors.placeholder,
  },
  taskFormSaveButton: {
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  taskFormSaveButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  priorityRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: themeColors.inputBackground,
    marginHorizontal: spacing.xs,
  },
  priorityOptionActive: {
    borderWidth: 0,
  },
  priorityOptionText: {
    ...typography.body,
    fontWeight: '500',
    color: themeColors.textSecondary,
  },
  priorityOptionTextActive: {
    color: themeColors.text,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dateTimeRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  dateInput: {
    flex: 1,
    marginRight: spacing.md,
  },
  timeInput: {
    flex: 1,
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
  },
  dateButtonText: {
    ...typography.body,
    color: themeColors.text,
  },
  placeholderText: {
    color: themeColors.placeholder,
  },
  taskModalScreen: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  taskModalCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    ...shadows.large,
  },
  taskModalHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    minHeight: 96,
    justifyContent: 'center',
  },
  taskModalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskModalIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  taskModalHeaderText: {
    flex: 1,
  },
  taskModalTitle: {
    ...typography.h2,
    color: '#FFFFFF',
  },
  taskModalSubtitle: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  taskModalCloseButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskModalBody: {
    padding: spacing.lg,
  },
  taskModalInputContainer: {
    marginBottom: spacing.md,
  },
  taskModalInput: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    backgroundColor: themeColors.inputBackground,
  },
  taskModalInputText: {
    color: themeColors.text,
  },
  quickLabel: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  quickGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  taskFormConflictBox: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskFormConflictText: {
    ...typography.caption,
    marginLeft: spacing.xs,
    flex: 1,
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
  taskModalButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  taskModalButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  taskModalSecondaryButton: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskModalSecondaryText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  taskModalPrimaryButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  taskModalPrimaryInner: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskModalPrimaryText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  taskModalPrimaryDisabled: {
    opacity: 0.6,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  detailTitle: {
    ...typography.h2,
    color: themeColors.text,
    marginBottom: spacing.sm,
  },
  priorityBadgeLarge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  priorityTextLarge: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailLabel: {
    ...typography.caption,
    color: themeColors.textLight,
    marginBottom: spacing.xs,
  },
  detailDescription: {
    ...typography.body,
    color: themeColors.text,
    marginBottom: spacing.lg,
  },
  peopleLoadingText: {
    ...typography.body,
    color: themeColors.textLight,
    marginBottom: spacing.lg,
  },
  peoplePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  peoplePill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: themeColors.border,
    backgroundColor: themeColors.inputBackground,
  },
  peoplePillText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: themeColors.text,
  },
  peopleButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  peopleHintText: {
    ...typography.caption,
    color: themeColors.textLight,
    flex: 1,
  },
  peopleModalHint: {
    ...typography.body,
    color: themeColors.textSecondary,
    marginBottom: spacing.md,
  },
  peopleEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  peopleEmptyText: {
    ...typography.body,
    color: themeColors.textLight,
    marginTop: spacing.sm,
  },
  peopleCard: {
    marginTop: spacing.sm,
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  peopleRowText: {
    flex: 1,
    marginRight: spacing.md,
  },
  peopleName: {
    ...typography.body,
    fontWeight: '700',
    color: themeColors.text,
  },
  peopleUsername: {
    ...typography.bodySmall,
    color: themeColors.textLight,
  },
  scheduleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.inputBackground,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  scheduleContent: {
    marginLeft: spacing.md,
  },
  scheduleLabel: {
    ...typography.caption,
    color: themeColors.textLight,
  },
  scheduleValue: {
    ...typography.body,
    fontWeight: '500',
    color: themeColors.text,
  },
  detailButtons: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  detailButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  completeButton: {
    marginBottom: spacing.lg,
  },
  noteContentText: {
    ...typography.body,
    color: themeColors.text,
    marginVertical: spacing.lg,
    lineHeight: 24,
  },
  noteContentInput: {
    minHeight: 240,
    textAlignVertical: 'top',
  },
  noteDetailContainer: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  noteDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
    backgroundColor: themeColors.background,
  },
  noteHeaderButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: themeColors.background,
  },
  noteHeaderBackButton: {
    borderWidth: 1,
    borderColor: themeColors.border,
    backgroundColor: themeColors.background,
  },
  noteHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteDeleteButton: {
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: themeColors.danger,
    backgroundColor: themeColors.background,
  },
  noteModeToggleButton: {
    minWidth: 54,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: themeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${themeColors.primary}1A`,
    marginRight: spacing.xs,
  },
  noteModeToggleText: {
    ...typography.caption,
    color: themeColors.primary,
    fontWeight: '600',
  },
  noteDoneButton: {
    borderWidth: 1,
    borderColor: themeColors.primary,
    backgroundColor: themeColors.background,
  },
  noteEditBody: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  noteEditBodyContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    backgroundColor: themeColors.background,
  },
  noteEditTitle: {
    ...typography.h2,
    color: themeColors.text,
    marginBottom: spacing.md,
  },
  noteEditContent: {
    ...typography.body,
    color: themeColors.text,
    paddingVertical: spacing.sm,
    backgroundColor: themeColors.background,
    borderRadius: 0,
    minHeight: 0,
    lineHeight: 22,
  },
  noteReadModeContainer: {
    flexGrow: 1,
  },
  noteReadContent: {
    ...typography.body,
    color: themeColors.text,
    lineHeight: 22,
    paddingVertical: spacing.sm,
  },
  noteReadContentEmpty: {
    color: themeColors.textSecondary,
  },
  securitySection: {
    marginTop: spacing.md,
  },
  errorText: {
    color: themeColors.danger,
    marginBottom: spacing.sm,
  },
});
};

export default TasksScreen;
