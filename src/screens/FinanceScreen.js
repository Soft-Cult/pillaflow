import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import {
  Card,
  Modal,
  Button,
  Input,
  ChipGroup,
  PlatformScrollView,
  PlatformDatePicker,
} from '../components';
import {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
  incomeCategories,
  expenseCategories,
  defaultCurrencies,
} from '../utils/theme';

const budgetCadenceOptions = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'yearly', label: 'Yearly' },
];

const recurringWeekdayOptions = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const recurringMonthOptions = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

const recurringDayOfMonthOptions = Array.from({ length: 31 }, (_value, index) => ({
  value: index + 1,
  label: String(index + 1),
}));

const budgetTypeOptions = [
  { value: 'budget', label: 'Budget envelope' },
  { value: 'recurring', label: 'Recurring payments' },
];

const categoryPalette = [
  '#10B981',
  '#EF4444',
  '#6366F1',
  '#F59E0B',
  '#EC4899',
  '#3B82F6',
  '#9CA3AF',
  '#14B8A6',
];

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeRecurringText = (value) =>
  String(value || '').trim().toLowerCase();

const getRecurringPaymentKey = (groupId, payment = {}) => {
  const paymentId = String(payment.id || '').trim();
  return `${groupId || ''}::${paymentId || normalizeRecurringText(payment.name)}`;
};

const toDateInputValue = (dateValue = new Date()) => {
  const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDateInputValue = (value, fallbackValue = new Date()) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(ISO_DATE_ONLY_PATTERN);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const parsed = new Date(year, month, day);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const fallback = fallbackValue instanceof Date
    ? fallbackValue
    : new Date(fallbackValue || Date.now());
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
};

const clampNumber = (value, minimum, maximum) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
};

const getStartOfDay = (dateValue) => {
  const date = parseDateInputValue(dateValue, new Date());
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getDaysInMonth = (year, monthIndex) => {
  return new Date(year, monthIndex + 1, 0).getDate();
};

const getNextWeeklyDueDate = (weekdayValue, referenceDateValue) => {
  const referenceDate = getStartOfDay(referenceDateValue);
  const weekday = clampNumber(weekdayValue, 0, 6);
  const offsetDays = (weekday - referenceDate.getDay() + 7) % 7;
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() + offsetDays
  );
};

const getNextMonthlyDueDate = (dayValue, referenceDateValue) => {
  const referenceDate = getStartOfDay(referenceDateValue);
  const preferredDay = clampNumber(dayValue, 1, 31);
  const currentMonthLimit = getDaysInMonth(
    referenceDate.getFullYear(),
    referenceDate.getMonth()
  );
  let candidate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    Math.min(preferredDay, currentMonthLimit)
  );

  if (candidate < referenceDate) {
    const nextMonthBase = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + 1,
      1
    );
    const nextMonthLimit = getDaysInMonth(
      nextMonthBase.getFullYear(),
      nextMonthBase.getMonth()
    );
    candidate = new Date(
      nextMonthBase.getFullYear(),
      nextMonthBase.getMonth(),
      Math.min(preferredDay, nextMonthLimit)
    );
  }

  return candidate;
};

const getNextYearlyDueDate = (monthValue, dayValue, referenceDateValue) => {
  const referenceDate = getStartOfDay(referenceDateValue);
  const preferredMonthIndex = clampNumber(monthValue, 1, 12) - 1;
  const preferredDay = clampNumber(dayValue, 1, 31);
  const currentYear = referenceDate.getFullYear();

  const currentYearLimit = getDaysInMonth(currentYear, preferredMonthIndex);
  let candidate = new Date(
    currentYear,
    preferredMonthIndex,
    Math.min(preferredDay, currentYearLimit)
  );

  if (candidate < referenceDate) {
    const nextYear = currentYear + 1;
    const nextYearLimit = getDaysInMonth(nextYear, preferredMonthIndex);
    candidate = new Date(
      nextYear,
      preferredMonthIndex,
      Math.min(preferredDay, nextYearLimit)
    );
  }

  return candidate;
};

const formatWindowLabel = (start, end) => {
  if (!start || !end) return '';
  const endDisplay = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const fmt = (date) =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  return `${fmt(start)} - ${fmt(endDisplay)}`;
};

const formatCadenceLabel = (cadence) => {
  if (cadence === 'weekly') return 'Weekly';
  if (cadence === 'yearly') return 'Yearly';
  return 'Monthly';
};

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x, y, radius, startAngle, endAngle) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M',
    x,
    y,
    'L',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    'Z',
  ].join(' ');
};

const PieChart = ({ data, size = 200 }) => {
  const radius = size / 2;
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  if (!total) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', height: size }}>
        <Text style={typography.bodySmall}>No expenses to chart</Text>
      </View>
    );
  }

  let startAngle = 0;
  const slices = data.map((item) => {
    const angle = (Number(item.value) / total) * 360;
    const slice = {
      ...item,
      startAngle,
      endAngle: startAngle + angle,
    };
    startAngle += angle;
    return slice;
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G x={0} y={0}>
        <Circle cx={radius} cy={radius} r={radius} fill={colors.card} />
        {slices.map((slice, idx) => (
          <Path
            key={`${slice.label}-${idx}`}
            d={describeArc(radius, radius, radius, slice.startAngle, slice.endAngle)}
            fill={slice.color}
          />
        ))}
      </G>
    </Svg>
  );
};

const FinanceScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    finances,
    addTransaction,
    deleteTransaction,
    getTransactionsForDate,
    getFinanceSummaryForDate,
    budgetGroups,
    budgetAssignments,
    addBudgetGroup,
    addRecurringPaymentToGroup,
    deleteBudgetGroup,
    getBudgetSpendForGroup,
    profile,
    isPremium,
    userSettings,
    themeColors,
    themeName,
    ensureFinancesLoaded,
  } = useApp();
  const palette = themeColors || colors;
  const isDark =
    (themeName || '').toLowerCase() === 'dark' || palette.background === '#000000';
  const balanceGradient = isDark
    ? ['#1D4ED8', '#0EA5E9']
    : ['#3B82F6', '#38BDF8'];
  const premiumActive = !!(isPremium || profile?.isPremium);
  const styles = useMemo(
    () => createStyles(themeColors, isDark),
    [themeColors, isDark]
  );

  useEffect(() => {
    ensureFinancesLoaded();
  }, [ensureFinancesLoaded]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [transactionsExpanded, setTransactionsExpanded] = useState(true);

  // Transaction form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(defaultCurrencies[0]);
  const [transactionDate, setTransactionDate] = useState(
    toDateInputValue(new Date())
  );
  const [reference, setReference] = useState('');

  // Budget form state
  const [budgetName, setBudgetName] = useState('');
  const [budgetType, setBudgetType] = useState('budget');
  const [budgetCadence, setBudgetCadence] = useState('monthly');
  const [budgetTarget, setBudgetTarget] = useState('');
  const [budgetCategories, setBudgetCategories] = useState([]);
  const [budgetNote, setBudgetNote] = useState('');

  // Recurring payment form state
  const [recurringName, setRecurringName] = useState('');
  const [recurringAmount, setRecurringAmount] = useState('');
  const [recurringCadence, setRecurringCadence] = useState('monthly');
  const [recurringNextDueDate, setRecurringNextDueDate] = useState(
    toDateInputValue(new Date())
  );
  const [recurringWeeklyDay, setRecurringWeeklyDay] = useState(new Date().getDay());
  const [recurringMonthlyDay, setRecurringMonthlyDay] = useState(
    new Date().getDate()
  );
  const [recurringYearlyMonth, setRecurringYearlyMonth] = useState(
    new Date().getMonth() + 1
  );
  const [recurringYearlyDay, setRecurringYearlyDay] = useState(
    new Date().getDate()
  );
  const [activeGroupForRecurring, setActiveGroupForRecurring] = useState(null);
  const [assignToBudget, setAssignToBudget] = useState(false);
  const [selectedBudgetGroupId, setSelectedBudgetGroupId] = useState(null);

  useEffect(() => {
    const preferred = defaultCurrencies.find(
      (c) => c.code === userSettings?.defaultCurrencyCode
    );
    if (preferred) {
      setSelectedCurrency(preferred);
    }
  }, [userSettings?.defaultCurrencyCode]);

  const currencyForCode = (code) =>
    defaultCurrencies.find((c) => c.code === code) || selectedCurrency;

  const formatDateForInput = (date) => toDateInputValue(date);

  const dailySummary = useMemo(() => {
    return getFinanceSummaryForDate(selectedDate);
  }, [finances, selectedDate]);

  const dayTransactions = useMemo(() => {
    return getTransactionsForDate(selectedDate);
  }, [finances, selectedDate]);

  const monthStart = useMemo(() => {
    const target = new Date(selectedDate);
    return new Date(target.getFullYear(), target.getMonth(), 1);
  }, [selectedDate]);

  const nextMonthStart = useMemo(() => {
    return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  }, [monthStart]);

  const monthlyTransactions = useMemo(() => {
    return finances.filter((t) => {
      const ts = new Date(t.date || t.createdAt);
      return ts >= monthStart && ts < nextMonthStart;
    });
  }, [finances, monthStart, nextMonthStart]);

  const monthlyIncome = useMemo(
    () =>
      monthlyTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [monthlyTransactions]
  );

  const monthlyExpenses = useMemo(
    () =>
      monthlyTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [monthlyTransactions]
  );

  const expenseBreakdown = useMemo(() => {
    const totals = {};
    monthlyTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const key = t.category || 'Other';
        totals[key] = (totals[key] || 0) + (Number(t.amount) || 0);
      });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], idx) => ({
        label,
        value,
        color: categoryPalette[idx % categoryPalette.length],
      }));
  }, [monthlyTransactions]);

  const budgetSummaries = useMemo(() => {
    return (budgetGroups || []).map((group) => {
      const { spent, start, end } = getBudgetSpendForGroup(group, selectedDate);
      const target = Number(group.target) || 0;
      const progress = target ? Math.min(spent / target, 1) : 0;
      const recurringTotal = Array.isArray(group.recurringPayments)
        ? group.recurringPayments.reduce(
            (sum, item) => sum + (Number(item.amount) || 0),
            0
          )
        : 0;

      return {
        group,
        spent,
        target,
        remaining: target ? target - spent : 0,
        progress,
        recurringTotal,
        windowLabel: formatWindowLabel(start, end),
      };
    });
  }, [budgetGroups, getBudgetSpendForGroup, selectedDate]);

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setCustomCategory('');
    setReference('');
    setTransactionDate(formatDateForInput(selectedDate));
    setAssignToBudget(false);
    setSelectedBudgetGroupId(null);
  };

  const resetBudgetForm = () => {
    setBudgetName('');
    setBudgetType('budget');
    setBudgetCadence('monthly');
    setBudgetTarget('');
    setBudgetCategories([]);
    setBudgetNote('');
  };

  const getNormalizedRecurringCadence = (cadenceValue) => {
    if (cadenceValue === 'weekly' || cadenceValue === 'yearly') {
      return cadenceValue;
    }
    return 'monthly';
  };

  const computeRecurringDueDateByCadence = ({
    cadence = recurringCadence,
    weeklyDay = recurringWeeklyDay,
    monthlyDay = recurringMonthlyDay,
    yearlyMonth = recurringYearlyMonth,
    yearlyDay = recurringYearlyDay,
    referenceDate = selectedDate || new Date(),
  } = {}) => {
    const normalizedCadence = getNormalizedRecurringCadence(cadence);
    if (normalizedCadence === 'weekly') {
      return getNextWeeklyDueDate(weeklyDay, referenceDate);
    }
    if (normalizedCadence === 'yearly') {
      return getNextYearlyDueDate(yearlyMonth, yearlyDay, referenceDate);
    }
    return getNextMonthlyDueDate(monthlyDay, referenceDate);
  };

  const applyRecurringCadenceDate = (nextValues = {}) => {
    const nextDue = computeRecurringDueDateByCadence(nextValues);
    setRecurringNextDueDate(formatDateForInput(nextDue));
  };

  const seedRecurringCadenceValues = (seedDateValue) => {
    const seedDate = parseDateInputValue(seedDateValue, selectedDate || new Date());
    setRecurringWeeklyDay(seedDate.getDay());
    setRecurringMonthlyDay(seedDate.getDate());
    setRecurringYearlyMonth(seedDate.getMonth() + 1);
    setRecurringYearlyDay(seedDate.getDate());
    return seedDate;
  };

  const resetRecurringForm = () => {
    const seedDate = seedRecurringCadenceValues(new Date());
    setRecurringName('');
    setRecurringAmount('');
    setRecurringCadence('monthly');
    setRecurringNextDueDate(
      formatDateForInput(
        computeRecurringDueDateByCadence({
          cadence: 'monthly',
          monthlyDay: seedDate.getDate(),
          referenceDate: seedDate,
        })
      )
    );
    setActiveGroupForRecurring(null);
  };

  const handleAddIncome = async () => {
    if (!amount || !category) return;

    await addTransaction({
      type: 'income',
      amount: parseFloat(amount),
      category: category === 'custom' ? customCategory : category,
      currency: selectedCurrency.code,
      date: transactionDate,
      reference: reference.trim() || null,
    });

    resetForm();
    setShowIncomeModal(false);
  };

  const handleAddExpense = async () => {
    if (!amount || !category) return;
    const budgetGroupIds = assignToBudget && selectedBudgetGroupId
      ? [selectedBudgetGroupId]
      : [];

    await addTransaction({
      type: 'expense',
      amount: parseFloat(amount),
      category: category === 'custom' ? customCategory : category,
      currency: selectedCurrency.code,
      date: transactionDate,
      reference: reference.trim() || null,
      budgetGroupIds,
    });

    resetForm();
    setShowExpenseModal(false);
  };

  const handleCreateBudgetGroup = async () => {
    if (!budgetName.trim()) return;

    await addBudgetGroup({
      name: budgetName.trim(),
      type: budgetType,
      cadence: budgetCadence,
      target: budgetType === 'budget' ? parseFloat(budgetTarget) || 0 : 0,
      categories: budgetType === 'budget' ? budgetCategories : [],
      note: budgetNote,
      currency: selectedCurrency.code,
    });

    resetBudgetForm();
    setShowBudgetModal(false);
  };

  const handleAddRecurringPayment = async () => {
    if (!activeGroupForRecurring || !recurringName.trim() || !recurringNextDueDate) {
      return;
    }

    await addRecurringPaymentToGroup(activeGroupForRecurring, {
      name: recurringName.trim(),
      amount: parseFloat(recurringAmount) || 0,
      cadence: recurringCadence,
      nextDueDate: recurringNextDueDate,
    });

    resetRecurringForm();
    setShowRecurringModal(false);
  };

  const openRecurringModalForGroup = (groupId) => {
    const group = budgetGroups.find((entry) => entry.id === groupId) || null;
    const defaultCadence = getNormalizedRecurringCadence(group?.cadence);
    const seedDate = seedRecurringCadenceValues(selectedDate || new Date());

    setActiveGroupForRecurring(groupId);
    setShowRecurringModal(true);
    setRecurringName('');
    setRecurringAmount('');
    setRecurringCadence(defaultCadence);
    setRecurringNextDueDate(
      formatDateForInput(
        computeRecurringDueDateByCadence({
          cadence: defaultCadence,
          weeklyDay: seedDate.getDay(),
          monthlyDay: seedDate.getDate(),
          yearlyMonth: seedDate.getMonth() + 1,
          yearlyDay: seedDate.getDate(),
          referenceDate: seedDate,
        })
      )
    );
  };

  const formatCurrency = (value, showSign = false, currencyCode) => {
    const currency = currencyForCode(currencyCode);
    const formatted = `${currency.symbol}${Math.abs(value).toLocaleString()}`;
    if (showSign && value !== 0) {
      return value > 0 ? `+${formatted}` : `-${formatted}`;
    }
    return formatted;
  };

  const formatDate = (dateValue) => {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const getCategoryIcon = (categoryName, type) => {
    const categories =
      type === 'income' ? incomeCategories : expenseCategories;
    const found = categories.find(
      (c) => c.id === categoryName || c.name === categoryName
    );
    return found?.icon || 'help-circle';
  };
  const getCategoryLabel = (categoryId) =>
    expenseCategories.find((cat) => cat.id === categoryId)?.name || categoryId;

  const shiftSelectedDate = (days) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  useEffect(() => {
    if (!assignToBudget) {
      return;
    }
    if (!selectedBudgetGroup) {
      setCategory((prev) => (prev === '' ? prev : ''));
      return;
    }
    const allowedIds = expenseCategoryOptions.map((cat) => cat.id);
    const fallback = allowedIds.includes('bills')
      ? 'bills'
      : allowedIds[0] || '';
    setCategory((prev) => (allowedIds.includes(prev) ? prev : fallback));
  }, [
    assignToBudget,
    selectedBudgetGroup,
    expenseCategoryOptions,
  ]);

  const handleOpenIncome = () => {
    setTransactionDate(formatDateForInput(selectedDate));
    setShowIncomeModal(true);
  };

  const handleOpenExpense = () => {
    setTransactionDate(formatDateForInput(selectedDate));
    setShowExpenseModal(true);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setTransactionDate(formatDateForInput(date));
  };
  const handleRecurringCadenceSelect = (cadenceValue) => {
    const normalizedCadence = getNormalizedRecurringCadence(cadenceValue);
    setRecurringCadence(normalizedCadence);
    applyRecurringCadenceDate({ cadence: normalizedCadence });
  };

  const handleRecurringWeeklyDaySelect = (weekdayValue) => {
    const weekday = clampNumber(weekdayValue, 0, 6);
    setRecurringWeeklyDay(weekday);
    applyRecurringCadenceDate({ weeklyDay: weekday });
  };

  const handleRecurringMonthlyDaySelect = (dayValue) => {
    const dayOfMonth = clampNumber(dayValue, 1, 31);
    setRecurringMonthlyDay(dayOfMonth);
    applyRecurringCadenceDate({ monthlyDay: dayOfMonth });
  };

  const handleRecurringYearlyMonthSelect = (monthValue) => {
    const month = clampNumber(monthValue, 1, 12);
    setRecurringYearlyMonth(month);
    applyRecurringCadenceDate({ yearlyMonth: month });
  };

  const handleRecurringYearlyDaySelect = (dayValue) => {
    const dayOfMonth = clampNumber(dayValue, 1, 31);
    setRecurringYearlyDay(dayOfMonth);
    applyRecurringCadenceDate({ yearlyDay: dayOfMonth });
  };

  const openBudgetGroupInsight = (groupId) => {
    if (!groupId) return;
    navigation.navigate('BudgetGroupInsight', { groupId });
  };

  const openSpendingInsights = () => {
    navigation.navigate('SpendingInsights', {
      selectedDate: selectedDate.toISOString(),
    });
  };

  const monthlyWindowLabel = formatWindowLabel(monthStart, nextMonthStart);
  const activeRecurringGroup = budgetGroups.find(
    (group) => group.id === activeGroupForRecurring
  );
  const recurringDuePickerValue = useMemo(() => {
    return parseDateInputValue(recurringNextDueDate, selectedDate || new Date());
  }, [recurringNextDueDate, selectedDate]);
  const selectedBudgetGroup = useMemo(
    () => budgetGroups.find((group) => group.id === selectedBudgetGroupId),
    [budgetGroups, selectedBudgetGroupId]
  );
  const expenseCategoryOptions = useMemo(() => {
    if (assignToBudget && selectedBudgetGroup) {
      const allowedIds = selectedBudgetGroup.categories || [];
      if (!allowedIds.length) {
        return selectedBudgetGroup.type === 'recurring'
          ? expenseCategories
          : [];
      }
      return expenseCategories.filter((cat) => allowedIds.includes(cat.id));
    }
    return expenseCategories;
  }, [assignToBudget, selectedBudgetGroup]);
  const recurringPaymentStats = useMemo(() => {
    const stats = {};
    const groupsById = Object.fromEntries(
      (budgetGroups || []).map((group) => [group.id, group])
    );

    finances
      .filter((transaction) => transaction.type === 'expense')
      .forEach((transaction) => {
        const assignedGroupIds = budgetAssignments?.[transaction.id] || [];
        if (!assignedGroupIds.length) return;

        const referenceKey = normalizeRecurringText(transaction.reference);
        if (!referenceKey) return;

        assignedGroupIds.forEach((groupId) => {
          const group = groupsById[groupId];
          if (!group) return;
          const recurringPayments = Array.isArray(group.recurringPayments)
            ? group.recurringPayments
            : [];
          const matchedPayment = recurringPayments.find(
            (payment) => normalizeRecurringText(payment.name) === referenceKey
          );
          if (!matchedPayment) return;

          const paymentKey = getRecurringPaymentKey(group.id, matchedPayment);
          const txTime = new Date(
            transaction.date || transaction.createdAt
          ).getTime();
          const currentStats = stats[paymentKey] || {
            count: 0,
            lastPaidAt: null,
          };

          currentStats.count += 1;
          if (
            Number.isFinite(txTime) &&
            (!currentStats.lastPaidAt || txTime > currentStats.lastPaidAt)
          ) {
            currentStats.lastPaidAt = txTime;
          }

          stats[paymentKey] = currentStats;
        });
      });

    return stats;
  }, [budgetGroups, budgetAssignments, finances]);
  const recurringTopByGroup = useMemo(() => {
    const topByGroup = {};

    (budgetGroups || []).forEach((group) => {
      const recurringPayments = Array.isArray(group.recurringPayments)
        ? group.recurringPayments
        : [];
      let top = null;

      recurringPayments.forEach((payment) => {
        const stats = recurringPaymentStats[getRecurringPaymentKey(group.id, payment)];
        const count = stats?.count || 0;
        if (!top || count > top.count) {
          top = {
            name: payment.name || 'Recurring payment',
            count,
          };
        }
      });

      topByGroup[group.id] = top && top.count > 0 ? top : null;
    });

    return topByGroup;
  }, [budgetGroups, recurringPaymentStats]);
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing.xxxl + insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Finances</Text>
            <Text style={styles.headerSubtitle}>Track spending, budgets, and cash flow</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Date Picker */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateArrow}
            onPress={() => shiftSelectedDate(-1)}
          >
            <Ionicons name="chevron-back" size={20} color={palette.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.datePicker}
            activeOpacity={0.85}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={palette.textSecondary}
            />
            <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color={palette.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateArrow}
            onPress={() => shiftSelectedDate(1)}
          >
            <Ionicons name="chevron-forward" size={20} color={palette.text} />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.incomeButton]}
            onPress={handleOpenIncome}
          >
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Record Income</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.expenseButton]}
            onPress={handleOpenExpense}
          >
            <Ionicons name="remove-circle" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Record Expense</Text>
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <Card style={styles.balanceCard} onPress={openSpendingInsights}>
          <LinearGradient
            colors={balanceGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceGradient}
          >
            <View style={styles.balanceHeader}>
              <View style={styles.balanceHeaderLeft}>
                <View style={styles.balanceBadge}>
                  <Ionicons name="wallet-outline" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.balanceLabel}>Total Balance</Text>
              </View>
              <View style={styles.balanceTrend}>
                <Ionicons name="stats-chart-outline" size={18} color="#FFFFFF" />
              </View>
            </View>
            <Text
              style={[
                styles.balanceAmount,
                dailySummary.balance < 0 && styles.balanceNegative,
              ]}
            >
              {formatCurrency(dailySummary.balance)}
            </Text>
            <View style={styles.balanceSummary}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Ionicons name="arrow-up-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.summaryLabel}>Income</Text>
                </View>
                <Text style={styles.summaryValue}>
                  {formatCurrency(dailySummary.income)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Ionicons name="arrow-down-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.summaryLabel}>Expenses</Text>
                </View>
                <Text style={styles.summaryValue}>
                  {formatCurrency(dailySummary.expenses)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Card>

        {/* Transactions List */}
        <Card style={styles.transactionsCard}>
          <View style={styles.transactionsHeader}>
            <Text style={[styles.sectionTitle, styles.transactionsTitle]}>
              Transactions
            </Text>
            <TouchableOpacity
              style={styles.sectionToggleButton}
              activeOpacity={0.85}
              onPress={() => setTransactionsExpanded((previous) => !previous)}
            >
              <Ionicons
                name={transactionsExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={palette.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {transactionsExpanded ? (
            dayTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Text style={styles.emptyIconText}>$</Text>
                </View>
                <Text style={styles.emptyText}>No transactions for this date</Text>
              </View>
            ) : (
              dayTransactions
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((transaction) => {
                  const referenceLabel = String(transaction.reference || '').trim();
                  const transactionTitle = referenceLabel || transaction.category || 'Transaction';
                  const transactionSubtitle = [
                    referenceLabel ? transaction.category : null,
                    formatDate(transaction.date),
                  ]
                    .filter(Boolean)
                    .join(' - ');

                  return (
                    <TouchableOpacity
                      key={transaction.id}
                      style={styles.transactionItem}
                      onPress={() => deleteTransaction(transaction.id)}
                    >
                      <View
                        style={[
                          styles.transactionIcon,
                          {
                            backgroundColor:
                              transaction.type === 'income'
                                ? `${palette.income}15`
                                : `${palette.expense}15`,
                          },
                        ]}
                      >
                        <Feather
                          name={getCategoryIcon(transaction.category, transaction.type)}
                          size={18}
                          color={
                            transaction.type === 'income'
                              ? palette.income
                              : palette.expense
                          }
                        />
                      </View>
                      <View style={styles.transactionContent}>
                        <Text style={styles.transactionCategory}>
                          {transactionTitle}
                        </Text>
                        <Text style={styles.transactionDate}>
                          {transactionSubtitle}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.transactionAmount,
                          transaction.type === 'income'
                            ? styles.incomeAmount
                            : styles.expenseAmount,
                        ]}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {currencyForCode(transaction.currency).symbol}
                        {transaction.amount.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })
            )
          ) : null}
        </Card>

        {premiumActive ? (
          <>
            <Card style={styles.insightsCard} onPress={openSpendingInsights}>
              <View style={styles.insightsHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Spending insights</Text>
                  <Text style={styles.insightsSubtitle}>
                    {monthlyWindowLabel}
                  </Text>
                </View>
                <View style={styles.insightsRight}>
                  <TouchableOpacity
                    style={styles.inlineLink}
                    onPress={openSpendingInsights}
                  >
                    <Text style={styles.inlineLinkText}>View details</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={palette.finance}
                    />
                  </TouchableOpacity>
                  <View style={styles.insightsStats}>
                    <Text style={styles.subduedLabel}>Net</Text>
                    <Text
                      style={[
                        styles.insightsNet,
                        monthlyIncome - monthlyExpenses < 0 &&
                          styles.balanceNegative,
                      ]}
                    >
                      {formatCurrency(monthlyIncome - monthlyExpenses, true)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.premiumStatsRow}>
                <View style={styles.premiumStat}>
                  <Text style={styles.subduedLabel}>Income</Text>
                  <Text style={styles.premiumStatValue}>
                    {formatCurrency(monthlyIncome)}
                  </Text>
                </View>
                <View style={styles.premiumStat}>
                  <Text style={styles.subduedLabel}>Expenses</Text>
                  <Text style={styles.premiumStatValue}>
                    {formatCurrency(monthlyExpenses)}
                  </Text>
                </View>
              </View>

              <View style={styles.pieRow}>
                <PieChart data={expenseBreakdown} size={180} />
                <View style={styles.legendColumn}>
                  {expenseBreakdown.slice(0, 5).map((item) => (
                    <View key={item.label} style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: item.color },
                        ]}
                      />
                      <View style={styles.legendTextWrap}>
                        <Text style={styles.legendLabel}>{item.label}</Text>
                        <Text style={styles.legendValue}>
                          {formatCurrency(item.value)}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {expenseBreakdown.length === 0 && (
                    <Text style={styles.subduedLabel}>
                      Add expenses to see a breakdown.
                    </Text>
                  )}
                </View>
              </View>
            </Card>

            <Card style={styles.budgetCard}>
              <View style={styles.budgetHeader}>
                <Text style={styles.sectionTitle}>Budget manager</Text>
                <Button
                  title="New group"
                  onPress={() => setShowBudgetModal(true)}
                  size="small"
                  style={styles.createBudgetButton}
                  fullWidth={false}
                  disableTranslation
                />
              </View>
              {budgetSummaries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="target" size={40} color={palette.primary} />
                  <Text style={styles.emptyText}>
                    Create a budget group to track spending or recurring bills.
                  </Text>
                </View>
              ) : (
                budgetSummaries.map((summary) => (
                  <TouchableOpacity
                    key={summary.group.id}
                    style={styles.budgetGroupCard}
                    activeOpacity={0.9}
                    onPress={() => openBudgetGroupInsight(summary.group.id)}
                  >
                    <View style={styles.budgetGroupHeader}>
                      <View style={styles.budgetTitleBlock}>
                        <Text style={styles.budgetGroupTitle}>
                          {summary.group.name}
                        </Text>
                        <Text style={styles.budgetGroupMeta}>
                          {formatCadenceLabel(summary.group.cadence)}
                          {summary.windowLabel ? ` - ${summary.windowLabel}` : ''}
                        </Text>
                      </View>
                      <View style={styles.budgetActions}>
                        {summary.group.type === 'recurring' && (
                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              openRecurringModalForGroup(summary.group.id);
                            }}
                          >
                            <Feather
                              name="repeat"
                              size={16}
                              color={palette.text}
                            />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            deleteBudgetGroup(summary.group.id);
                          }}
                        >
                          <Feather
                            name="trash-2"
                            size={16}
                            color={palette.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>
                        Spent {formatCurrency(summary.spent, false, summary.group.currency)}
                      </Text>
                      <Text style={styles.progressLabel}>
                        {summary.target
                          ? `${formatCurrency(
                              summary.target,
                              false,
                              summary.group.currency
                            )} limit`
                          : 'Tracking only'}
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.min(summary.progress * 100, 100)}%` },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.remainingText,
                        summary.remaining < 0 && styles.balanceNegative,
                      ]}
                    >
                      {summary.target
                        ? `${summary.remaining >= 0 ? 'Remaining' : 'Over by'} ${formatCurrency(
                            Math.abs(summary.remaining),
                            false,
                            summary.group.currency
                          )}`
                        : 'No limit set'}
                    </Text>

                    {summary.group.type === 'budget' && (
                      <>
                        {(summary.group.categories || []).length ? (
                          <View style={styles.budgetCategoryGrid}>
                            {(summary.group.categories || []).map((cat) => (
                              <View key={cat} style={styles.budgetCategoryTile}>
                                <View style={styles.budgetCategoryIcon}>
                                  <Feather
                                    name={getCategoryIcon(cat, 'expense')}
                                    size={16}
                                    color={palette.text}
                                  />
                                </View>
                                <Text
                                  style={styles.budgetCategoryLabel}
                                  numberOfLines={2}
                                >
                                  {getCategoryLabel(cat)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.subduedLabel}>
                            No categories linked yet.
                          </Text>
                        )}
                      </>
                    )}

                    {summary.group.type === 'recurring' && (
                      <View style={styles.recurringList}>
                        {recurringTopByGroup[summary.group.id] && (
                          <Text style={styles.subduedLabel}>
                            Most recorded: {recurringTopByGroup[summary.group.id].name} (
                            {recurringTopByGroup[summary.group.id].count})
                          </Text>
                        )}
                        <Text style={styles.subduedLabel}>
                          Recurring payments
                          {summary.recurringTotal
                            ? ` - ${formatCurrency(
                                summary.recurringTotal,
                                false,
                                summary.group.currency
                              )} expected`
                            : ''}
                        </Text>
                        {(summary.group.recurringPayments || []).length === 0 ? (
                          <Text style={styles.subduedLabel}>
                            Add recurring payments with due dates to auto-post them.
                          </Text>
                        ) : (
                          summary.group.recurringPayments.map((item) => {
                            const paymentKey = getRecurringPaymentKey(
                              summary.group.id,
                              item
                            );
                            const paymentStats = recurringPaymentStats[paymentKey];
                            const lastPaidLabel = paymentStats?.lastPaidAt
                              ? `Last paid ${formatDate(new Date(paymentStats.lastPaidAt))}`
                              : 'Not recorded yet';
                            const nextDueLabel = item.nextDueDate
                              ? `Next due ${formatDate(
                                  parseDateInputValue(item.nextDueDate, new Date())
                                )}`
                              : 'Due date not set';
                            return (
                              <View
                                key={getRecurringPaymentKey(summary.group.id, item)}
                                style={styles.recurringItem}
                              >
                                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                                  <Text style={styles.recurringTitle}>
                                    {item.name}
                                  </Text>
                                  <Text style={styles.recurringMeta}>
                                    {formatCadenceLabel(item.cadence)}
                                    {paymentStats?.count
                                      ? ` - ${paymentStats.count} recorded`
                                      : ''}
                                  </Text>
                                  <Text style={styles.recurringTrackingMeta}>
                                    {nextDueLabel}
                                  </Text>
                                  <Text style={styles.recurringTrackingMeta}>
                                    {lastPaidLabel}
                                  </Text>
                                </View>
                                <Text style={styles.recurringAmount}>
                                  {formatCurrency(
                                    safeNumber(item.amount),
                                    false,
                                    summary.group.currency
                                  )}
                                </Text>
                              </View>
                            );
                          })
                        )}
                        <Button
                          title="Add recurring payment"
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            openRecurringModalForGroup(summary.group.id);
                          }}
                          variant="secondary"
                          style={styles.inlineButton}
                          disableTranslation
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </Card>
          </>
        ) : (
          <Card style={styles.lockedCard}>
            <View style={styles.lockedHeader}>
              <View style={styles.lockedIconWrap}>
                <Ionicons name="lock-closed" size={18} color={palette.finance} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lockedTitle}>
                  Budgets & insights are Premium
                </Text>
                <Text style={styles.lockedText}>
                  Upgrade to track recurring payment groups, budgets, and
                  spending insights.
                </Text>
              </View>
            </View>
            <Button
              title="Upgrade to Premium"
              icon="star"
              onPress={() => navigation.navigate('Paywall', { source: 'finance' })}
              style={styles.upgradeButton}
              disableTranslation
            />
          </Card>
        )}

      </PlatformScrollView>

      {/* Income Modal */}
      <Modal
        visible={showIncomeModal}
        onClose={() => {
          setShowIncomeModal(false);
          resetForm();
        }}
        title="Record Income"
      >
        <Text style={styles.inputLabel}>Amount</Text>
        <View style={styles.amountInputContainer}>
          <Text style={styles.currencySymbol}>{selectedCurrency.symbol}</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={palette.placeholder}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.inputLabel}>Category</Text>
        <View style={styles.categoryGrid}>
          {incomeCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryOption,
                category === cat.id && styles.categoryOptionActive,
              ]}
              onPress={() => setCategory(cat.id)}
            >
              <Feather
                name={cat.icon}
                size={20}
                color={category === cat.id ? palette.primary : palette.textSecondary}
              />
              <Text
                style={[
                  styles.categoryLabel,
                  category === cat.id && styles.categoryLabelActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Reference (optional)"
          value={reference}
          onChangeText={setReference}
          placeholder="e.g. Salary bonus, Freelance invoice"
        />

        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowIncomeModal(false);
              resetForm();
            }}
            style={styles.modalButton}
          />
          <Button
            title="Add Income"
            variant="success"
            onPress={handleAddIncome}
            disabled={!amount || !category}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      {/* Expense Modal */}
      <Modal
        visible={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
          resetForm();
        }}
        title="Record Expense"
      >
        <Text style={styles.inputLabel}>Amount</Text>
        <View style={styles.amountInputContainer}>
          <Text style={styles.currencySymbol}>{selectedCurrency.symbol}</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={palette.placeholder}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.inputLabel}>Category</Text>
        {assignToBudget && !selectedBudgetGroup ? (
          <Text style={styles.subduedLabel}>
            Select a budget group to choose its categories.
          </Text>
        ) : expenseCategoryOptions.length === 0 ? (
          <Text style={styles.subduedLabel}>
            This budget group has no categories yet.
          </Text>
        ) : (
          <View style={styles.categoryGrid}>
            {expenseCategoryOptions.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryOption,
                  category === cat.id && styles.categoryOptionActive,
                ]}
                onPress={() => setCategory(cat.id)}
              >
                <Feather
                  name={cat.icon}
                  size={20}
                  color={category === cat.id ? palette.primary : palette.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryLabel,
                    category === cat.id && styles.categoryLabelActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Input
          label="Reference (optional)"
          value={reference}
          onChangeText={setReference}
          placeholder="e.g. Costco run, Uber to airport"
        />

        <TouchableOpacity
          style={styles.budgetToggle}
          onPress={() =>
            setAssignToBudget((prev) => {
              const nextValue = !prev;
              if (!nextValue) {
                setSelectedBudgetGroupId(null);
              }
              return nextValue;
            })
          }
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.checkbox,
              assignToBudget && styles.checkboxChecked,
            ]}
          >
            {assignToBudget && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.budgetToggleText}>Add to Budget Group</Text>
        </TouchableOpacity>

        {assignToBudget && (
          <View style={styles.budgetSelect}>
            {budgetGroups.length === 0 ? (
              <Text style={styles.subduedLabel}>
                Create a budget group first to attach this expense.
              </Text>
            ) : (
              budgetGroups.map((group) => {
                const selected = selectedBudgetGroupId === group.id;
                return (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.budgetOption,
                      selected && styles.budgetOptionSelected,
                    ]}
                    onPress={() => setSelectedBudgetGroupId(group.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.budgetOptionDot,
                        selected && styles.budgetOptionDotSelected,
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.budgetOptionLabel,
                          selected && styles.budgetOptionLabelSelected,
                        ]}
                      >
                        {group.name}
                      </Text>
                      <Text style={styles.budgetOptionMeta}>
                        {formatCadenceLabel(group.cadence)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowExpenseModal(false);
              resetForm();
            }}
            style={styles.modalButton}
          />
          <Button
            title="Add Expense"
            variant="danger"
            onPress={handleAddExpense}
            disabled={!amount || !category}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      {/* Budget Modal */}
      <Modal
        visible={showBudgetModal}
        onClose={() => {
          setShowBudgetModal(false);
          resetBudgetForm();
        }}
        title="New budget group"
      >
        <Input
          label="Group name"
          value={budgetName}
          onChangeText={setBudgetName}
          placeholder="e.g. Household bills"
        />

        <Text style={styles.inputLabel}>Type</Text>
        <ChipGroup
          options={budgetTypeOptions}
          selectedValue={budgetType}
          onSelect={setBudgetType}
          style={styles.chipRow}
        />

        <Text style={styles.inputLabel}>Cadence</Text>
        <ChipGroup
          options={budgetCadenceOptions}
          selectedValue={budgetCadence}
          onSelect={setBudgetCadence}
          style={styles.chipRow}
        />

        {budgetType === 'budget' && (
          <>
            <Text style={styles.inputLabel}>Target amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>{selectedCurrency.symbol}</Text>
              <TextInput
                style={styles.amountInput}
                value={budgetTarget}
                onChangeText={setBudgetTarget}
                placeholder="0"
                placeholderTextColor={palette.placeholder}
                keyboardType="decimal-pad"
              />
            </View>

            <Text style={styles.inputLabel}>Categories</Text>
            <ChipGroup
              options={expenseCategories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              multiSelect
              selectedValues={budgetCategories}
              onSelect={setBudgetCategories}
              style={styles.chipRow}
            />
          </>
        )}

        <Input
          label="Notes (optional)"
          value={budgetNote}
          onChangeText={setBudgetNote}
          placeholder="Add context for this group"
          multiline
          numberOfLines={3}
        />

        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowBudgetModal(false);
              resetBudgetForm();
            }}
            style={styles.modalButton}
          />
          <Button
            title="Save group"
            onPress={handleCreateBudgetGroup}
            disabled={!budgetName}
            style={styles.modalButton}
            disableTranslation
          />
        </View>
      </Modal>

      {/* Recurring Payment Modal */}
      <Modal
        visible={showRecurringModal}
        onClose={() => {
          setShowRecurringModal(false);
          resetRecurringForm();
        }}
        title="Add recurring payment"
      >
        <Text style={styles.inputLabel}>Group</Text>
        <View style={styles.selectedGroupBanner}>
          <Feather name="layers" size={16} color={palette.finance} />
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={styles.recurringTitle}>
              {activeRecurringGroup?.name || 'Select a group'}
            </Text>
            {activeRecurringGroup && (
              <Text style={styles.recurringMeta}>
                {formatCadenceLabel(activeRecurringGroup.cadence)}
              </Text>
            )}
          </View>
        </View>

        <Input
          label="Payment name"
          value={recurringName}
          onChangeText={setRecurringName}
          placeholder="e.g. Rent, Gym, Subscriptions"
        />

        <Text style={styles.inputLabel}>Amount</Text>
        <View style={styles.amountInputContainer}>
          <Text style={styles.currencySymbol}>{selectedCurrency.symbol}</Text>
          <TextInput
            style={styles.amountInput}
            value={recurringAmount}
            onChangeText={setRecurringAmount}
            placeholder="0"
            placeholderTextColor={palette.placeholder}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.inputLabel}>Cadence</Text>
        <ChipGroup
          options={budgetCadenceOptions}
          selectedValue={recurringCadence}
          onSelect={handleRecurringCadenceSelect}
          style={styles.chipRow}
        />

        {recurringCadence === 'weekly' ? (
          <View style={styles.cadencePickerSection}>
            <Text style={styles.subduedLabel}>Choose day of week</Text>
            <ChipGroup
              options={recurringWeekdayOptions}
              selectedValue={recurringWeeklyDay}
              onSelect={handleRecurringWeeklyDaySelect}
              size="small"
              style={styles.cadenceChipGroup}
            />
          </View>
        ) : null}

        {recurringCadence === 'monthly' ? (
          <View style={styles.cadencePickerSection}>
            <Text style={styles.subduedLabel}>Choose day of month</Text>
            <ChipGroup
              options={recurringDayOfMonthOptions}
              selectedValue={recurringMonthlyDay}
              onSelect={handleRecurringMonthlyDaySelect}
              size="small"
              style={styles.cadenceChipGroup}
            />
          </View>
        ) : null}

        {recurringCadence === 'yearly' ? (
          <View style={styles.cadencePickerSection}>
            <Text style={styles.subduedLabel}>Choose month</Text>
            <ChipGroup
              options={recurringMonthOptions}
              selectedValue={recurringYearlyMonth}
              onSelect={handleRecurringYearlyMonthSelect}
              size="small"
              style={styles.cadenceChipGroup}
            />
            <Text style={styles.subduedLabel}>Choose day of month</Text>
            <ChipGroup
              options={recurringDayOfMonthOptions}
              selectedValue={recurringYearlyDay}
              onSelect={handleRecurringYearlyDaySelect}
              size="small"
              style={styles.cadenceChipGroup}
            />
          </View>
        ) : null}

        <Text style={styles.inputLabel}>Next due date</Text>
        <View style={styles.modalDatePicker}>
          <Ionicons name="calendar-outline" size={18} color={palette.textSecondary} />
          <Text style={styles.modalDateText}>
            {formatDate(recurringDuePickerValue)}
          </Text>
        </View>

        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowRecurringModal(false);
              resetRecurringForm();
            }}
            style={styles.modalButton}
          />
          <Button
            title="Add payment"
            onPress={handleAddRecurringPayment}
            disabled={!recurringName || !activeRecurringGroup || !recurringNextDueDate}
            style={styles.modalButton}
            disableTranslation
          />
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <PlatformDatePicker
        visible={showDatePicker}
        value={selectedDate}
        onChange={handleDateChange}
        onClose={() => setShowDatePicker(false)}
        accentColor={palette.finance}
      />
    </View>
  );
};

const createStyles = (themeColorsParam, isDark = false) => {
  const isAndroid = Platform.OS === 'android';
  const palette = themeColorsParam || colors;
  const text = palette.text || colors.text;
  const textSecondary = palette.textSecondary || colors.textSecondary;
  const subduedText = isDark ? '#B5BAC7' : textSecondary;
  const pageBackground = isDark ? palette.background : '#F5F6FF';
  const surface = isDark ? '#0F1116' : '#F7F8FF';
  const surfaceAlt = isDark ? '#171B26' : '#EEF2FF';
  const surfaceBorder = isDark ? '#232838' : '#E1E6FF';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isAndroid ? '#E5E9F2' : pageBackground,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: isAndroid ? spacing.sm : spacing.xl,
      paddingBottom: isAndroid ? spacing.xxl : spacing.xxxl,
      paddingTop: isAndroid ? 0 : spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: isAndroid ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      paddingVertical: isAndroid ? spacing.sm : spacing.md,
      marginBottom: isAndroid ? spacing.xs : spacing.sm,
    },
    headerTitle: {
      ...typography.h1,
      fontSize: isAndroid ? 24 : 34,
      fontWeight: '700',
      textAlign: 'left',
      flex: 0,
      color: text,
      textTransform: isAndroid ? 'uppercase' : 'none',
      letterSpacing: isAndroid ? 1.2 : 0,
    },
    headerSubtitle: {
      ...typography.bodySmall,
      marginTop: 2,
      color: textSecondary,
      fontSize: isAndroid ? 12 : typography.bodySmall.fontSize,
    },
    headerSpacer: {
      width: 0,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isAndroid ? spacing.sm : spacing.lg,
      justifyContent: 'space-between',
    },
    dateArrow: {
      padding: isAndroid ? spacing.xs : spacing.sm,
      borderRadius: isAndroid ? 2 : borderRadius.full,
      backgroundColor: palette.card,
      borderWidth: isAndroid ? 2 : 1,
      borderColor: surfaceBorder,
      ...(isAndroid ? {} : shadows.small),
    },
    datePicker: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: isAndroid ? spacing.sm : spacing.lg,
      borderRadius: isAndroid ? 2 : borderRadius.full,
      backgroundColor: palette.card,
      marginHorizontal: isAndroid ? spacing.xs : spacing.sm,
      borderWidth: isAndroid ? 2 : 1,
      borderColor: surfaceBorder,
      justifyContent: 'center',
    },
    dateText: {
      ...typography.body,
      marginHorizontal: spacing.sm,
      color: text,
      fontWeight: '600',
    },
    actionRow: {
      flexDirection: 'row',
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: borderRadius.xl,
      minHeight: 48,
      ...shadows.small,
    },
    incomeButton: {
      backgroundColor: palette.income,
    },
    expenseButton: {
      backgroundColor: palette.expense,
    },
    actionButtonText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
      marginLeft: spacing.sm,
    },
    balanceCard: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
      padding: 0,
      overflow: 'hidden',
      marginBottom: spacing.lg,
      ...shadows.large,
    },
    balanceGradient: {
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      minHeight: 180,
      justifyContent: 'space-between',
    },
    balanceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    balanceHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    balanceBadge: {
      width: 30,
      height: 30,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    balanceTrend: {
      width: 30,
      height: 30,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    balanceLabel: {
      ...typography.bodySmall,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '600',
    },
    balanceAmount: {
      fontSize: 34,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: spacing.md,
    },
    balanceNegative: {
      color: '#FFCDD2',
    },
    balanceSummary: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    summaryCard: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)',
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    summaryLabel: {
      ...typography.caption,
      color: 'rgba(255,255,255,0.85)',
    },
    summaryValue: {
      ...typography.h3,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    insightsCard: {
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: surfaceBorder,
      backgroundColor: palette.card,
    },
    insightsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    insightsRight: {
      alignItems: 'flex-end',
      gap: spacing.xs,
    },
    insightsSubtitle: {
      ...typography.caption,
      color: subduedText,
    },
    insightsStats: {
      alignItems: 'flex-end',
    },
    inlineLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: `${palette.finance}12`,
      borderWidth: 1,
      borderColor: `${palette.finance}22`,
    },
    inlineLinkText: {
      ...typography.caption,
      color: palette.finance,
      fontWeight: '600',
    },
    insightsNet: {
      ...typography.h3,
      color: palette.finance,
    },
    premiumStatsRow: {
      flexDirection: 'row',
      gap: spacing.lg,
      marginTop: spacing.sm,
    },
    premiumStat: {
      flex: 1,
      paddingVertical: spacing.sm,
    },
    premiumStatValue: {
      ...typography.h3,
      color: text,
    },
    pieRow: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    legendColumn: {
      flex: 1,
      gap: spacing.sm,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    legendTextWrap: {
      flex: 1,
    },
    legendLabel: {
      ...typography.body,
      color: text,
    },
    legendValue: {
      ...typography.caption,
      color: subduedText,
    },
    budgetCard: {
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: surfaceBorder,
      backgroundColor: palette.card,
    },
    budgetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    budgetGroupCard: {
      borderWidth: 1,
      borderColor: surfaceBorder,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginTop: spacing.sm,
      backgroundColor: surface,
      ...shadows.small,
    },
    budgetGroupHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    budgetTitleBlock: {
      flex: 1,
      paddingRight: spacing.md,
    },
    budgetGroupTitle: {
      ...typography.h3,
      color: text,
    },
    budgetGroupMeta: {
      ...typography.caption,
      color: subduedText,
      marginTop: 2,
    },
    budgetActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    progressLabel: {
      ...typography.bodySmall,
      color: subduedText,
    },
    progressBar: {
      height: 8,
      backgroundColor: surfaceAlt,
      borderRadius: borderRadius.full,
      marginTop: spacing.xs,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: palette.finance,
      borderRadius: borderRadius.full,
    },
    remainingText: {
      ...typography.bodySmall,
      color: text,
      marginTop: spacing.xs,
    },
    budgetCategoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
      justifyContent: 'space-between',
    },
    budgetCategoryTile: {
      width: '22%',
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: surfaceAlt,
      borderWidth: 1,
      borderColor: surfaceBorder,
    },
    budgetCategoryIcon: {
      width: 28,
      height: 28,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: surfaceBorder,
      marginBottom: spacing.xs,
    },
    budgetCategoryLabel: {
      ...typography.caption,
      textAlign: 'center',
      color: subduedText,
    },
    recurringList: {
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    recurringItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    recurringTitle: {
      ...typography.body,
      color: text,
    },
    recurringMeta: {
      ...typography.caption,
      color: subduedText,
    },
    recurringTrackingMeta: {
      ...typography.caption,
      color: subduedText,
      marginTop: 2,
    },
    recurringAmount: {
      ...typography.body,
      fontWeight: '700',
      color: palette.finance,
    },
    inlineButton: {
      marginTop: spacing.xs,
    },
    lockedCard: {
      marginBottom: spacing.lg,
      padding: spacing.lg,
      backgroundColor: palette.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: palette.border,
      ...shadows.small,
    },
    lockedHeader: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    lockedIconWrap: {
      width: 38,
      height: 38,
      borderRadius: borderRadius.full,
      backgroundColor: `${palette.finance}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockedTitle: {
      ...typography.h3,
      color: text,
    },
    lockedText: {
      ...typography.bodySmall,
      color: subduedText,
      marginTop: spacing.xs,
    },
    upgradeButton: {
      marginTop: spacing.sm,
      backgroundColor: palette.finance,
      borderColor: palette.finance,
    },
    transactionsCard: {
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: surfaceBorder,
      backgroundColor: palette.card,
    },
    transactionsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    transactionsTitle: {
      marginBottom: 0,
    },
    sectionToggleButton: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: surfaceAlt,
      borderWidth: 1,
      borderColor: surfaceBorder,
    },
    sectionTitle: {
      ...typography.h3,
      marginBottom: spacing.md,
      color: text,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    emptyIconCircle: {
      width: 64,
      height: 64,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: surfaceAlt,
      borderWidth: 1,
      borderColor: surfaceBorder,
    },
    emptyIconText: {
      fontSize: 34,
      fontWeight: '700',
      color: palette.primary,
    },
    emptyText: {
      ...typography.bodySmall,
      color: subduedText,
      marginTop: spacing.md,
    },
    transactionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: surfaceBorder,
    },
    transactionIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    transactionContent: {
      flex: 1,
    },
    transactionCategory: {
      ...typography.body,
      fontWeight: '500',
      color: text,
    },
    transactionDate: {
      ...typography.caption,
      color: subduedText,
    },
    transactionAmount: {
      ...typography.body,
      fontWeight: '600',
    },
    incomeAmount: {
      color: palette.income,
    },
    expenseAmount: {
      color: palette.expense,
    },
    inputLabel: {
      ...typography.label,
      marginBottom: spacing.sm,
      color: text,
    },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.inputBackground,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
    },
    currencySymbol: {
      ...typography.h2,
      color: textSecondary,
      marginRight: spacing.sm,
    },
    amountInput: {
      flex: 1,
      fontSize: 24,
      fontWeight: '600',
      paddingVertical: spacing.md,
      color: text,
    },
    modalDatePicker: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: palette.inputBackground,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      marginBottom: spacing.md,
    },
    modalDateText: {
      ...typography.body,
      flex: 1,
      marginHorizontal: spacing.sm,
      color: text,
      fontWeight: '600',
    },
    cadencePickerSection: {
      marginBottom: spacing.sm,
    },
    cadenceChipGroup: {
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.lg,
    },
    categoryOption: {
      width: '30%',
      alignItems: 'center',
      paddingVertical: spacing.md,
      marginRight: '3%',
      marginBottom: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: palette.inputBackground,
    },
    categoryOptionActive: {
      backgroundColor: palette.primaryLight,
    },
    categoryLabel: {
      ...typography.caption,
      marginTop: spacing.xs,
      color: textSecondary,
    },
    categoryLabelActive: {
      color: palette.primary,
      fontWeight: '600',
    },
    budgetToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    budgetToggleText: {
      ...typography.body,
      color: text,
      marginLeft: spacing.sm,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.inputBackground,
    },
    checkboxChecked: {
      backgroundColor: palette.finance,
      borderColor: palette.finance,
    },
    budgetSelect: {
      marginBottom: spacing.lg,
      gap: spacing.xs,
    },
    budgetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.inputBackground,
    },
    budgetOptionSelected: {
      borderColor: palette.finance,
      backgroundColor: `${palette.finance}12`,
    },
    budgetOptionDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: spacing.sm,
      borderWidth: 1,
      borderColor: palette.border,
    },
    budgetOptionDotSelected: {
      backgroundColor: palette.finance,
      borderColor: palette.finance,
    },
    budgetOptionLabel: {
      ...typography.body,
      color: text,
    },
    budgetOptionLabelSelected: {
      color: palette.finance,
      fontWeight: '700',
    },
    budgetOptionMeta: {
      ...typography.caption,
      color: subduedText,
    },
    modalButtons: {
      flexDirection: 'row',
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    modalButton: {
      flex: 1,
      marginHorizontal: spacing.xs,
    },
    iconButton: {
      padding: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: surfaceAlt,
      borderWidth: 1,
      borderColor: surfaceBorder,
    },
    createBudgetButton: {
      paddingHorizontal: spacing.md,
      minWidth: 0,
      maxWidth: 140,
      alignSelf: 'flex-end',
      borderRadius: borderRadius.full,
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    subduedLabel: {
      ...typography.caption,
      color: subduedText,
    },
    chipRow: {
      marginBottom: spacing.md,
    },
    selectedGroupBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: palette.inputBackground,
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: spacing.md,
    },
  });
};

export default FinanceScreen;
