import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, useWindowDimensions, TextInput, Modal as RNModal, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Modal, Button, Input, PlatformScrollView } from '../components';
import useWeightManagerOverview from '../hooks/useWeightManagerOverview';
import {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
} from '../utils/theme';
import {
  lookupFoodByBarcode,
  searchFoodsByQuery,
} from '../utils/foodBarcodeLookup';
import { toLocalDateKey } from '../utils/insights';


const MOOD_OPTIONS = [
  { key: 'happy', label: 'Happy', emoji: '\u{1F60A}', tone: 'positive', color: '#FFD166', bg: '#FFF4CC', accent: '#F59E0B' },
  { key: 'loved', label: 'Loved', emoji: '\u{1F970}', tone: 'positive', color: '#FF8FAB', bg: '#FFE4EC', accent: '#F472B6' },
  { key: 'peaceful', label: 'Peaceful', emoji: '\u{1F60C}', tone: 'positive', color: '#A7F3D0', bg: '#E8FFF6', accent: '#10B981' },
  { key: 'excited', label: 'Excited', emoji: '\u{1F929}', tone: 'positive', color: '#FDBA74', bg: '#FFEAD5', accent: '#F97316' },
  { key: 'confident', label: 'Confident', emoji: '\u{1F60E}', tone: 'positive', color: '#60A5FA', bg: '#E0F2FF', accent: '#3B82F6' },
  { key: 'celebrating', label: 'Celebrating', emoji: '\u{1F973}', tone: 'positive', color: '#F472B6', bg: '#FFE4F0', accent: '#EC4899' },
  { key: 'tired', label: 'Tired', emoji: '\u{1F634}', tone: 'neutral', color: '#A1A1AA', bg: '#F3F4F6', accent: '#6B7280' },
  { key: 'okay', label: 'Okay', emoji: '\u{1F610}', tone: 'neutral', color: '#FACC15', bg: '#FEF3C7', accent: '#D97706' },
  { key: 'thoughtful', label: 'Thoughtful', emoji: '\u{1F914}', tone: 'neutral', color: '#C084FC', bg: '#F3E8FF', accent: '#8B5CF6' },
  { key: 'sad', label: 'Sad', emoji: '\u{1F622}', tone: 'negative', color: '#93C5FD', bg: '#DBEAFE', accent: '#3B82F6' },
  { key: 'anxious', label: 'Anxious', emoji: '\u{1F630}', tone: 'negative', color: '#F59E0B', bg: '#FEF3C7', accent: '#D97706' },
  { key: 'frustrated', label: 'Frustrated', emoji: '\u{1F624}', tone: 'negative', color: '#F87171', bg: '#FEE2E2', accent: '#EF4444' },
];

const seededRandom = (seed) => {
  let value = 0;
  const str = String(seed || '');
  for (let i = 0; i < str.length; i += 1) {
    value = (value * 31 + str.charCodeAt(i)) % 100000;
  }
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
};
// Basic offline mapping so scans can populate fields without a network call.
// Replace/extend this with your own lookup or API integration.
const BARCODE_FOOD_MAP = {
  '012345678905': { name: 'Granola Bar', calories: 190, proteinGrams: 6, carbsGrams: 29, fatGrams: 5 },
  '04963406': { name: 'Greek Yogurt', calories: 100, proteinGrams: 17, carbsGrams: 6, fatGrams: 0 },
};

const formatStepsNumber = (value) =>
  Number(value || 0).toLocaleString('en-US');

const formatStepsDateLabel = (value) => {
  const parsed = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const HealthScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { width: windowWidth } = useWindowDimensions();
  const {
    authUser,
    healthData,
    waterLogs,
    addFoodEntryForDate,
    deleteFoodEntryForDate,
    updateHealthForDate,
    profile,
    getAverageWater,
    getAverageSleep,
    healthDailyMetrics,
    nutritionDailyTotals,
    themeName,
    themeColors,
    ensureHealthLoaded,
  } = useApp();
  const isDark = themeName === 'dark';
  const swipeCardWidth = Math.max(0, windowWidth - spacing.xl * 2);
  const healthTheme = useMemo(() => {
    const baseCard = isDark ? '#1D2236' : '#FFFFFF';
    return {
      background: isDark ? themeColors.background : '#F6F4FF',
      stats: {
        water: {
          card: baseCard,
          border: isDark ? '#1F3148' : '#D6E9FF',
          iconBg: isDark ? '#1D3551' : '#D9ECFF',
          iconColor: isDark ? '#7DD3FC' : themeColors.info,
          label: isDark ? '#C7D2FE' : themeColors.textSecondary,
          value: isDark ? '#7DD3FC' : themeColors.info,
          goal: isDark ? '#A5B4FC' : themeColors.textLight,
        },
        sleep: {
          card: baseCard,
          border: isDark ? '#2F2448' : '#E5D6FF',
          iconBg: isDark ? '#2F2448' : '#E8DCFF',
          iconColor: isDark ? '#C4B5FD' : themeColors.primary,
          label: isDark ? '#C7D2FE' : themeColors.textSecondary,
          value: isDark ? '#C4B5FD' : themeColors.primary,
          goal: isDark ? '#A5B4FC' : themeColors.textLight,
        },
      },
      calorie: {
        card: baseCard,
        border: isDark ? '#263A31' : '#CFEEDD',
        title: isDark ? '#6EE7B7' : '#16A34A',
        label: isDark ? '#C7D2FE' : themeColors.textSecondary,
        goal: isDark ? '#6EE7B7' : '#16A34A',
        consumed: isDark ? '#FDBA74' : '#F97316',
        ring: isDark ? '#34D399' : '#10B981',
        ringBg: baseCard,
        heroGradient: isDark ? ['#0F766E', '#16A34A'] : ['#22C55E', '#16A34A'],
        heroText: '#FFFFFF',
        buttonGradient: isDark ? ['#34D399', '#6EE7B7'] : ['#86EFAC', '#34D399'],
      },
      food: {
        card: baseCard,
        border: isDark ? '#3A2C22' : '#F7D8C0',
        title: isDark ? '#FDBA74' : '#F97316',
        itemBg: isDark ? '#33271E' : '#FFF8F2',
        itemBorder: isDark ? '#443426' : '#F4D6C0',
        buttonBorder: isDark ? '#FDBA74' : '#F97316',
        buttonText: isDark ? '#FDBA74' : '#F97316',
      },
      mood: {
        card: baseCard,
        border: isDark ? '#3A2A40' : '#F3C8FF',
        title: isDark ? '#E879F9' : '#C026D3',
        text: isDark ? '#D1C4E9' : themeColors.textSecondary,
        overviewGradient: isDark ? ['#2A2136', '#241D30'] : ['#FFF1F6', '#FFF6E9'],
        previewGradient: isDark ? ['#1F2A3E', '#20362F'] : ['#D9F1FF', '#E3F8EC'],
        iconBg: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.7)',
        sparkleBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
        sparkle: isDark ? '#FDE68A' : '#F59E0B',
        count: isDark ? '#F5B8E9' : '#EC4899',
        previewBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.65)',
      },
      sleep: {
        card: baseCard,
        border: isDark ? '#2C334C' : '#E5E7EB',
        title: isDark ? '#A5B4FC' : '#4F46E5',
        inputBg: isDark ? '#232A42' : '#F9FAFB',
        inputBorder: isDark ? '#323A57' : '#E5E7EB',
        chipBg: isDark ? '#2B314A' : '#F3F4F6',
        chipActiveBg: isDark ? '#4F46E5' : '#6D28D9',
        chipText: isDark ? '#C7D2FE' : themeColors.textSecondary,
        chipActiveText: '#FFFFFF',
        logBg: isDark ? '#242B44' : '#F6F7FF',
        logBorder: isDark ? '#333B5A' : '#E3E8FF',
      },
      water: {
        card: baseCard,
        border: isDark ? '#223A4E' : '#CFE8FF',
        title: isDark ? '#38BDF8' : '#0284C7',
        count: isDark ? '#7DD3FC' : '#0284C7',
        progressBg: isDark ? '#223447' : '#D9ECFF',
        progressFill: isDark ? '#38BDF8' : '#0EA5E9',
        inputBg: isDark ? '#1C3346' : '#FFFFFF',
        inputBorder: isDark ? '#2E465A' : '#D6E9FF',
        buttonBg: isDark ? '#0EA5E9' : '#0284C7',
        buttonGradient: isDark ? ['#38BDF8', '#1D4ED8'] : ['#22D3EE', '#0284C7'],
        buttonText: '#FFFFFF',
      },
    };
  }, [isDark, themeColors]);
  const gardenTheme = useMemo(
    () => ({
      headerGradient: isDark ? ['#3A235A', '#2D1E3D'] : ['#FF7FA7', '#FFB36B'],
      skyGradient: isDark ? ['#1E2339', '#2B2F4A'] : ['#EAF4FF', '#F9FCFF'],
      groundGradient: isDark ? ['#1F4D3A', '#2F6B52'] : ['#A7F3D0', '#86EFAC'],
      card: isDark ? '#1B1F33' : '#FFFFFF',
      border: isDark ? 'rgba(255,255,255,0.12)' : '#EFEAF7',
      muted: isDark ? 'rgba(255,255,255,0.7)' : themeColors.textSecondary,
      soft: isDark ? 'rgba(255,255,255,0.08)' : '#F5F7FF',
      sun: isDark ? '#FCD34D' : '#F59E0B',
    }),
    [isDark, themeColors]
  );
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const moodPickerToneBackgrounds = useMemo(
    () =>
      isDark
        ? {
            positive: '#273143',
            neutral: '#2F3241',
            negative: '#3A2B36',
          }
        : null,
    [isDark]
  );

  useEffect(() => {
    ensureHealthLoaded();
  }, [ensureHealthLoaded]);

  const [isLookingUpBarcode, setIsLookingUpBarcode] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [foodCalories, setFoodCalories] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [foodFat, setFoodFat] = useState('');
  const [calorieGoalInput, setCalorieGoalInput] = useState('');
  const [proteinGoalInput, setProteinGoalInput] = useState('');
  const [carbsGoalInput, setCarbsGoalInput] = useState('');
  const [fatGoalInput, setFatGoalInput] = useState('');
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [healthSwipeIndex, setHealthSwipeIndex] = useState(0);
  const [foodGramsEaten, setFoodGramsEaten] = useState('');
  const [foodBasis, setFoodBasis] = useState(null);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showFoodSearchModal, setShowFoodSearchModal] = useState(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [foodSearchResults, setFoodSearchResults] = useState([]);
  const [isSearchingFoods, setIsSearchingFoods] = useState(false);
  const [foodSearchMessage, setFoodSearchMessage] = useState('');
  const [hasScanned, setHasScanned] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [selectedMoodIndex, setSelectedMoodIndex] = useState(null);
  const [moodThoughtInput, setMoodThoughtInput] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [plantedMoodKey, setPlantedMoodKey] = useState(null);
  const sunSpin = useRef(new Animated.Value(0)).current;
  const breeze = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;
  const plantAnim = useRef(new Animated.Value(0)).current;
  const restoreFoodModalRef = useRef(false);
  const restoreFoodModalFromSearchRef = useRef(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showJourneyTargetPrompt, setShowJourneyTargetPrompt] = useState(false);

  const moodOptions = MOOD_OPTIONS;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions
    ? useCameraPermissions()
    : [null, null];

  const parseGoalValue = (value, allowFloat = false) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = allowFloat ? parseFloat(trimmed) : parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return NaN;
    return parsed;
  };

  const handleSaveNutritionGoals = async () => {
    if (weightManagerIsActive) {
      Alert.alert(
        'Goals locked',
        'Your active weight loss journey controls daily calorie and macro goals until the journey is completed or reset.'
      );
      return;
    }
    const caloriesGoal = parseGoalValue(calorieGoalInput, false);
    if (Number.isNaN(caloriesGoal)) {
      Alert.alert('Enter calories', 'Please enter a positive number.');
      return;
    }

    const proteinGoal = parseGoalValue(proteinGoalInput, true);
    if (Number.isNaN(proteinGoal)) {
      Alert.alert('Enter protein', 'Please enter a positive number.');
      return;
    }

    const carbsGoal = parseGoalValue(carbsGoalInput, true);
    if (Number.isNaN(carbsGoal)) {
      Alert.alert('Enter carbs', 'Please enter a positive number.');
      return;
    }

    const fatGoal = parseGoalValue(fatGoalInput, true);
    if (Number.isNaN(fatGoal)) {
      Alert.alert('Enter fat', 'Please enter a positive number.');
      return;
    }

    try {
      setIsSavingGoals(true);
      await updateHealthForDate(selectedDateISO, {
        calorieGoal: caloriesGoal,
        proteinGoal,
        carbsGoal,
        fatGoal,
      });
      setShowGoalModal(false);
    } catch (err) {
      console.log('Error updating nutrition goals', err);
      Alert.alert('Unable to update goals', 'Please try again.');
    } finally {
      setIsSavingGoals(false);
    }
  };

  const handleClearNutritionGoals = async () => {
    if (weightManagerIsActive) {
      Alert.alert(
        'Goals locked',
        'Your active weight loss journey controls daily calorie and macro goals until the journey is completed or reset.'
      );
      return;
    }
    try {
      setIsSavingGoals(true);
      await updateHealthForDate(selectedDateISO, {
        calorieGoal: null,
        proteinGoal: null,
        carbsGoal: null,
        fatGoal: null,
      });
      setShowGoalModal(false);
    } catch (err) {
      console.log('Error resetting nutrition goals', err);
      Alert.alert('Unable to reset goals', 'Please try again.');
    } finally {
      setIsSavingGoals(false);
    }
  };

  const handleCancelNutritionGoals = () => {
    const goal = Number.isFinite(selectedHealth.calorieGoal)
      ? selectedHealth.calorieGoal
      : defaultCalorieGoal;
    const proteinGoal = Number.isFinite(selectedHealth.proteinGoal)
      ? selectedHealth.proteinGoal
      : defaultProteinGoal;
    const carbsGoal = Number.isFinite(selectedHealth.carbsGoal)
      ? selectedHealth.carbsGoal
      : defaultCarbsGoal;
    const fatGoal = Number.isFinite(selectedHealth.fatGoal)
      ? selectedHealth.fatGoal
      : defaultFatGoal;
    setCalorieGoalInput(goal ? String(goal) : '');
    setProteinGoalInput(proteinGoal !== null ? String(proteinGoal) : '');
    setCarbsGoalInput(carbsGoal !== null ? String(carbsGoal) : '');
    setFatGoalInput(fatGoal !== null ? String(fatGoal) : '');
    setShowGoalModal(false);
  };

  const handleSwipeEnd = (event) => {
    if (!swipeCardWidth) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / swipeCardWidth);
    setHealthSwipeIndex(nextIndex);
  };

  const handleLogFood = async () => {
    if (!foodName.trim()) return;

    const toNumberOrNull = (value) => {
      if (value === null || value === undefined) return null;
      const trimmed = value.toString().trim();
      if (trimmed === '') return null;
      const parsed = parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const gramsEaten = toNumberOrNull(foodGramsEaten);
    const caloriesValue = toNumberOrNull(foodCalories);
    const proteinValue = toNumberOrNull(foodProtein);
    const carbsValue = toNumberOrNull(foodCarbs);
    const fatValue = toNumberOrNull(foodFat);

    const shouldScale =
      foodBasis === '100g' && Number.isFinite(gramsEaten) && gramsEaten > 0;
    const scale = shouldScale ? gramsEaten / 100 : 1;

    const scaleMacro = (value) => {
      if (value === null || value === undefined) return null;
      if (!shouldScale) return value;
      const scaled = value * scale;
      return Number.isFinite(scaled) ? Math.round(scaled * 10) / 10 : null;
    };

    const caloriesNumber = caloriesValue ?? 0;
    const scaledCalories = shouldScale
      ? Math.round(caloriesNumber * scale)
      : caloriesNumber;

    await addFoodEntryForDate(selectedDateISO, {
      name: foodName.trim(),
      calories: scaledCalories,
      proteinGrams: scaleMacro(proteinValue),
      carbsGrams: scaleMacro(carbsValue),
      fatGrams: scaleMacro(fatValue),
    });

    setFoodName('');
    setFoodCalories('');
    setFoodProtein('');
    setFoodCarbs('');
    setFoodFat('');
    setFoodGramsEaten('');
    setFoodBasis(null);
    setShowFoodModal(false);
  };

  const handleOpenAddMeal = () => {
    if (showGoalModal) {
      setShowGoalModal(false);
      setTimeout(() => setShowFoodModal(true), 250);
      return;
    }
    setShowFoodModal(true);
  };

  const handleRelogFood = async (food) => {
    if (!food?.name) return;
    await addFoodEntryForDate(selectedDateISO, {
      name: food.name,
      calories: food.calories ?? 0,
      proteinGrams: food.proteinGrams ?? food.protein_grams ?? null,
      carbsGrams: food.carbsGrams ?? food.carbs_grams ?? null,
      fatGrams: food.fatGrams ?? food.fat_grams ?? null,
    });
  };

  const applyScannedFood = (payload) => {
    if (!payload) return;
    setFoodBasis(payload.basis || null);
    setFoodGramsEaten('');
    if (payload.name) setFoodName(payload.name);
    if (payload.calories !== undefined && payload.calories !== null) {
      setFoodCalories(String(payload.calories));
    }
    if (payload.proteinGrams !== undefined && payload.proteinGrams !== null) {
      setFoodProtein(String(payload.proteinGrams));
    }
    if (payload.carbsGrams !== undefined && payload.carbsGrams !== null) {
      setFoodCarbs(String(payload.carbsGrams));
    }
    if (payload.fatGrams !== undefined && payload.fatGrams !== null) {
      setFoodFat(String(payload.fatGrams));
    }
  };

  const handleSearchFoods = async () => {
    const query = foodSearchQuery.trim();
    if (query.length < 2) {
      setFoodSearchResults([]);
      setFoodSearchMessage('Enter at least 2 characters to search.');
      return;
    }

    setIsSearchingFoods(true);
    setFoodSearchMessage('');

    try {
      const results = await searchFoodsByQuery(query, {
        localMap: BARCODE_FOOD_MAP,
        limit: 24,
      });
      setFoodSearchResults(results);
      if (!results.length) {
        setFoodSearchMessage('No foods found. Try a different search term.');
      }
    } catch (err) {
      console.log('Food search error:', err);
      setFoodSearchResults([]);
      setFoodSearchMessage('Food search failed. Please try again.');
    } finally {
      setIsSearchingFoods(false);
    }
  };

  const handleOpenFoodSearch = () => {
    const nextQuery = foodName.trim();
    if (nextQuery) setFoodSearchQuery(nextQuery);
    setFoodSearchResults([]);
    setFoodSearchMessage('');
    setIsSearchingFoods(false);

    restoreFoodModalFromSearchRef.current = showFoodModal;
    if (showFoodModal) {
      setShowFoodModal(false);
      setTimeout(() => setShowFoodSearchModal(true), 0);
    } else {
      setShowFoodSearchModal(true);
    }
  };

  const handleSelectFoodSearchResult = (food) => {
    if (!food) return;
    applyScannedFood(food);

    setShowFoodSearchModal(false);
    setFoodSearchResults([]);
    setFoodSearchMessage('');
    setIsSearchingFoods(false);

    if (restoreFoodModalFromSearchRef.current) {
      restoreFoodModalFromSearchRef.current = false;
      setTimeout(() => setShowFoodModal(true), 0);
    }
  };

  const handleCloseFoodSearch = () => {
    setShowFoodSearchModal(false);
    setFoodSearchQuery('');
    setFoodSearchResults([]);
    setFoodSearchMessage('');
    setIsSearchingFoods(false);

    if (restoreFoodModalFromSearchRef.current) {
      restoreFoodModalFromSearchRef.current = false;
      setTimeout(() => setShowFoodModal(true), 0);
    }
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (isLookingUpBarcode) return;

    setHasScanned(true);
    setIsLookingUpBarcode(true);
    setScannerMessage('Looking up product...');

    try {
      const match = await lookupFoodByBarcode(data, { localMap: BARCODE_FOOD_MAP });

      if (match) {
        applyScannedFood(match);

        const basisParts = [];
        if (match.basis) basisParts.push(`per ${match.basis}`);
        if (match.servingSize) basisParts.push(match.servingSize);
        const basisNote = basisParts.length ? ` (${basisParts.join(', ')})` : '';
        const sourceNote = match.sourceLabel ? ` from ${match.sourceLabel}` : '';

        setScannerMessage(`Food details added${sourceNote}${basisNote}.`);
        setShowScannerModal(false);
        if (restoreFoodModalRef.current) {
          restoreFoodModalRef.current = false;
          setTimeout(() => setShowFoodModal(true), 0);
        }

        setHasScanned(false);
        return;
      }

      setScannerMessage(
        'No product found for that barcode. Try another item or fill manually.'
      );
      setTimeout(() => setHasScanned(false), 1200);
    } catch (err) {
      console.log('Barcode lookup error:', err);
      setScannerMessage('Lookup failed (network/API). Please try again.');
      setTimeout(() => setHasScanned(false), 1200);
    } finally {
      setIsLookingUpBarcode(false);
    }
  };

  const handleOpenScanner = async () => {
    setScannerMessage('');
    setHasScanned(false);
    restoreFoodModalRef.current = showFoodModal;
    if (showFoodModal) {
      setShowFoodModal(false);
      setTimeout(() => setShowScannerModal(true), 0);
    } else {
      setShowScannerModal(true);
    }
    if (!CameraView) {
      Alert.alert(
        'Scanner unavailable',
        'Camera module is missing. Please install expo-camera with "npx expo install expo-camera" and restart.'
      );
      return;
    }
    try {
      let permission = cameraPermission;
      if (permission?.granted !== true) {
        if (typeof requestCameraPermission === 'function') {
          permission = await requestCameraPermission();
        } else if (typeof Camera?.requestCameraPermissionsAsync === 'function') {
          permission = await Camera.requestCameraPermissionsAsync();
        }
      }

      if (!permission || permission.granted !== true) {
        Alert.alert('Camera permission needed', 'Please enable camera access to scan barcodes.');
        setScannerMessage('Camera permission is required to scan barcodes.');
        return;
      }
    } catch (err) {
      setScannerMessage('Unable to access camera for scanning.');
    }
  };

  const handleCloseScanner = () => {
    setShowScannerModal(false);
    setHasScanned(false);
    setScannerMessage('');
    if (restoreFoodModalRef.current) {
      restoreFoodModalRef.current = false;
      setTimeout(() => setShowFoodModal(true), 0);
    }
  };

  const selectedDateISO = selectedDate.toISOString().slice(0, 10);
  const selectedDateKey = selectedDateISO;
  const todayDateISO = toLocalDateKey(new Date());
  const selectedHealthMetric = healthDailyMetrics?.[selectedDateKey] || null;
  const selectedStepsTotal = Math.max(
    0,
    Math.round(Number(selectedHealthMetric?.steps) || 0)
  );
  const selectedDailyStepsGoal = Math.max(0, Math.round(Number(profile?.dailyStepsGoal) || 0));
  const selectedStepsGoalProgress =
    selectedDailyStepsGoal > 0
      ? Math.max(0, Math.min(999, Math.round((selectedStepsTotal / selectedDailyStepsGoal) * 100)))
      : null;

  const emptyDay = {
    mood: null,
    moodThought: null,
    waterIntake: 0,
    sleepTime: null,
    wakeTime: null,
    sleepQuality: null,
    calorieGoal: null,
    proteinGoal: null,
    carbsGoal: null,
    fatGoal: null,
    calories: 0,
    foods: [],
  };
  const selectedHealthRaw = healthData[selectedDateKey] || {};
  const selectedHealth = {
    ...emptyDay,
    ...selectedHealthRaw,
    foods: Array.isArray(selectedHealthRaw.foods) ? selectedHealthRaw.foods : [],
  };
  const selectedNutritionTotals = nutritionDailyTotals?.[selectedDateKey] || null;
  const getMoodThoughtValue = (day = {}) => {
    const rawValue = day?.moodThought ?? day?.mood_thought ?? day?.moodNote ?? '';
    if (typeof rawValue !== 'string') return '';
    return rawValue.trim();
  };
  const toPositiveGoalOrNull = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const defaultWeightManagerCalorieGoal = toPositiveGoalOrNull(profile?.weightManagerTargetCalories);
  const defaultCalorieGoal = Math.max(
    0,
    defaultWeightManagerCalorieGoal ?? (Number(profile?.dailyCalorieGoal) || 0)
  );
  const defaultProteinGoal = toPositiveGoalOrNull(profile?.weightManagerProteinGrams);
  const defaultCarbsGoal = toPositiveGoalOrNull(profile?.weightManagerCarbsGrams);
  const defaultFatGoal = toPositiveGoalOrNull(profile?.weightManagerFatGrams);
  const dailyCalorieGoal = Number.isFinite(selectedHealth.calorieGoal)
    ? selectedHealth.calorieGoal
    : defaultCalorieGoal;

  useEffect(() => {
    const goal = Number.isFinite(selectedHealth.calorieGoal)
      ? selectedHealth.calorieGoal
      : defaultCalorieGoal;
    setCalorieGoalInput(goal ? String(goal) : '');
    const proteinGoal = Number.isFinite(selectedHealth.proteinGoal)
      ? selectedHealth.proteinGoal
      : defaultProteinGoal;
    const carbsGoal = Number.isFinite(selectedHealth.carbsGoal)
      ? selectedHealth.carbsGoal
      : defaultCarbsGoal;
    const fatGoal = Number.isFinite(selectedHealth.fatGoal)
      ? selectedHealth.fatGoal
      : defaultFatGoal;
    setProteinGoalInput(proteinGoal !== null ? String(proteinGoal) : '');
    setCarbsGoalInput(carbsGoal !== null ? String(carbsGoal) : '');
    setFatGoalInput(fatGoal !== null ? String(fatGoal) : '');
  }, [
    selectedDateKey,
    selectedHealth.calorieGoal,
    selectedHealth.proteinGoal,
    selectedHealth.carbsGoal,
    selectedHealth.fatGoal,
    defaultCalorieGoal,
    defaultProteinGoal,
    defaultCarbsGoal,
    defaultFatGoal,
  ]);

  useEffect(() => {
    setShowGoalModal(false);
  }, [selectedDateKey]);

  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const [time, period] = timeStr.split(' ');
    const [hourStr, minuteStr] = time.split(':');
    let hours = parseInt(hourStr, 10);
    const minutes = parseInt(minuteStr, 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const getSleepDurationHours = (sleepTime, wakeTime) => {
    const start = parseTimeToMinutes(sleepTime);
    const end = parseTimeToMinutes(wakeTime);
    if (start === null || end === null) return null;
    const minutes = end >= start ? end - start : 24 * 60 - start + end;
    return Math.round((minutes / 60) * 10) / 10;
  };

  const sleepDurationHours = getSleepDurationHours(
    selectedHealth.sleepTime,
    selectedHealth.wakeTime
  );
  const sleepWeek = useMemo(() => {
    const baseDate = new Date(`${selectedDateISO}T00:00:00`);
    const start = new Date(baseDate);
    start.setDate(baseDate.getDate() - 6);
    return Array.from({ length: 7 }).map((_, idx) => {
      const day = new Date(start);
      day.setDate(start.getDate() + idx);
      const key = day.toISOString().slice(0, 10);
      const dayData = healthData[key] || {};
      const hours = getSleepDurationHours(dayData.sleepTime, dayData.wakeTime);
      return {
        key,
        hours: hours || 0,
        hasData: hours !== null,
      };
    });
  }, [healthData, selectedDateISO]);
  const sleepWeekAverage = useMemo(() => {
    const logged = sleepWeek.filter((day) => day.hasData);
    if (logged.length === 0) return null;
    const total = logged.reduce((sum, day) => sum + day.hours, 0);
    return Math.round((total / logged.length) * 10) / 10;
  }, [sleepWeek]);

  const waterDateKey = toLocalDateKey(selectedDate);
  const todayWaterLitres = useMemo(() => {
    const entries = waterLogs?.[waterDateKey] || [];
    const totalMl = entries.reduce(
      (sum, entry) => sum + (Number(entry.amountMl) || 0),
      0
    );
    return Math.max(0, totalMl) / 1000;
  }, [waterLogs, waterDateKey]);
  const normalizedWaterGoal = Math.max(0, Number(profile.dailyWaterGoal) || 0);
  const waterProgress = normalizedWaterGoal
    ? Math.min(1, todayWaterLitres / normalizedWaterGoal)
    : 0;
  const waterTotalMl = Math.max(0, Math.round(todayWaterLitres * 1000));
  const waterGoalMl = Math.max(0, Math.round(normalizedWaterGoal * 1000));
  const waterPercent =
    normalizedWaterGoal > 0 ? Math.round(waterProgress * 100) : 0;
  const waterValueColor = healthTheme.stats.water.value;
  const sleepValueColor = healthTheme.stats.sleep.value;
  const foodDerivedMacroTotals = (selectedHealth.foods || []).reduce(
    (totals, food) => ({
      protein: totals.protein + (Number(food.proteinGrams) || 0),
      carbs: totals.carbs + (Number(food.carbsGrams) || 0),
      fat: totals.fat + (Number(food.fatGrams) || 0),
    }),
    { protein: 0, carbs: 0, fat: 0 }
  );
  const caloriesConsumed = Number.isFinite(selectedNutritionTotals?.calories)
    ? selectedNutritionTotals.calories
    : selectedHealth.calories || 0;
  const caloriesRemaining = dailyCalorieGoal - caloriesConsumed;
  const {
    weightManagerPlan,
    weightManagerTargetBody,
    weightManagerStartingDisplay,
    weightManagerCurrentDisplay,
    weightManagerTargetDisplay,
    weightManagerIsActive,
  } = useWeightManagerOverview();
  const macroTotals = {
    protein: Number.isFinite(selectedNutritionTotals?.protein)
      ? selectedNutritionTotals.protein
      : foodDerivedMacroTotals.protein,
    carbs: Number.isFinite(selectedNutritionTotals?.carbs)
      ? selectedNutritionTotals.carbs
      : foodDerivedMacroTotals.carbs,
    fat: Number.isFinite(selectedNutritionTotals?.fat)
      ? selectedNutritionTotals.fat
      : foodDerivedMacroTotals.fat,
  };
  const macroGoals = {
    protein: Number.isFinite(selectedHealth.proteinGoal)
      ? selectedHealth.proteinGoal
      : defaultProteinGoal,
    carbs: Number.isFinite(selectedHealth.carbsGoal)
      ? selectedHealth.carbsGoal
      : defaultCarbsGoal,
    fat: Number.isFinite(selectedHealth.fatGoal)
      ? selectedHealth.fatGoal
      : defaultFatGoal,
  };
  const macroRemaining = {
    protein:
      macroGoals.protein !== null ? Math.max(macroGoals.protein - macroTotals.protein, 0) : null,
    carbs:
      macroGoals.carbs !== null ? Math.max(macroGoals.carbs - macroTotals.carbs, 0) : null,
    fat: macroGoals.fat !== null ? Math.max(macroGoals.fat - macroTotals.fat, 0) : null,
  };
  const hasMacroGoals = Object.values(macroGoals).some((value) => value !== null);
  const hasReachedJourneyTargets =
    weightManagerIsActive &&
    selectedDateISO === todayDateISO &&
    dailyCalorieGoal > 0 &&
    caloriesConsumed >= dailyCalorieGoal &&
    Object.entries(macroGoals).every(([key, goal]) => goal === null || macroTotals[key] >= goal);
  const remainingRatio = dailyCalorieGoal
    ? Math.max(0, caloriesRemaining) / dailyCalorieGoal
    : 1;
  const calorieCircleSize = 120;
  const getRemainingColor = () => {
    if (remainingRatio > 0.6) return colors.success;
    if (remainingRatio > 0.3) return colors.warning;
    return colors.danger;
  };

  const normalizeMoodIndex = (value) => {
    if (typeof value !== 'number') return null;
    return Math.min(moodOptions.length - 1, Math.max(0, value - 1));
  };

  const currentMoodIndex = () => {
    const idx = normalizeMoodIndex(selectedHealth.mood);
    return idx !== null ? idx : 7;
  };

  const activeMoodIndex =
    typeof selectedMoodIndex === 'number' ? selectedMoodIndex : currentMoodIndex();

  useEffect(() => {
    let cancelled = false;
    const syncJourneyTargetPrompt = async () => {
      if (!hasReachedJourneyTargets) return;
      const promptKey = [
        'health-journey-target',
        selectedDateISO,
        dailyCalorieGoal,
        macroGoals.protein ?? 'na',
        macroGoals.carbs ?? 'na',
        macroGoals.fat ?? 'na',
      ].join(':');
      const storageKey = `${promptKey}:${authUser?.id || 'anon'}`;
      const alreadyShown = await AsyncStorage.getItem(storageKey);
      if (cancelled || alreadyShown) return;
      await AsyncStorage.setItem(storageKey, 'shown');
      if (!cancelled) setShowJourneyTargetPrompt(true);
    };

    syncJourneyTargetPrompt().catch((err) => {
      console.log('Error showing journey target prompt:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [
    authUser?.id,
    dailyCalorieGoal,
    hasReachedJourneyTargets,
    macroGoals.carbs,
    macroGoals.fat,
    macroGoals.protein,
    selectedDateISO,
  ]);

  const moodEntries = useMemo(() => {
    const entries = [];
    Object.entries(healthData || {}).forEach(([dateKey, day]) => {
      const idx = normalizeMoodIndex(day?.mood);
      if (idx === null) return;
      entries.push({
        dateKey,
        moodIndex: idx,
        mood: moodOptions[idx],
      });
    });
    entries.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    return entries;
  }, [healthData, moodOptions]);

  const totalMoodCount = moodEntries.length;
  const positiveCount = moodEntries.filter((entry) => entry.mood?.tone === 'positive').length;
  const gardenHealthPercent =
    totalMoodCount > 0 ? Math.round((positiveCount / totalMoodCount) * 100) : 0;

  const gardenStatus = useMemo(() => {
    if (gardenHealthPercent >= 70) {
      return { label: 'Thriving Garden', emoji: '\u{1F338}' };
    }
    if (gardenHealthPercent >= 40) {
      return { label: 'Growing Garden', emoji: '\u{1F331}' };
    }
    return { label: 'Needs care', emoji: '\u{1F499}' };
  }, [gardenHealthPercent]);

  const gardenInsight = useMemo(() => {
    if (totalMoodCount === 0) {
      return 'Plant your first flower today to start your mood garden.';
    }
    if (gardenHealthPercent >= 70) {
      return 'Your garden is thriving! Keep nurturing those positive vibes.';
    }
    if (gardenHealthPercent >= 40) {
      return 'Your garden is growing. A few joyful moments can help it bloom.';
    }
    return 'Your garden needs care. Try a small act of kindness for yourself today.';
  }, [gardenHealthPercent, totalMoodCount]);

  const gardenFlowers = useMemo(() => {
    const slice = moodEntries.slice(-12);
    return slice.map((entry, idx) => {
      const rand = seededRandom(`${entry.dateKey}-${entry.mood?.key}-${idx}`);
      const left = 12 + rand() * 76;
      const top = 98 + rand() * 44;
      const stemHeight = 14 + rand() * 16;
      const sway = 2 + rand() * 4;
      const size = 22 + rand() * 10;
      return {
        ...entry,
        left,
        top,
        stemHeight,
        sway,
        size,
      };
    });
  }, [moodEntries]);

  const miniGardenFlowers = useMemo(
    () => moodEntries.slice(-5).map((entry) => entry.mood),
    [moodEntries]
  );

  const weeklyGarden = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      const idx = normalizeMoodIndex(healthData?.[key]?.mood);
      const label = date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
      days.push({
        key,
        label,
        mood: idx !== null ? moodOptions[idx] : null,
      });
    }
    return days;
  }, [healthData, moodOptions]);

  const weeklyMoodCount = weeklyGarden.filter((day) => day.mood).length;
  const sunRotate = sunSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const breezeRotate = breeze.interpolate({
    inputRange: [0, 1],
    outputRange: ['-1deg', '1deg'],
  });

  const confettiPieces = useMemo(() => {
    const palette = ['#FCD34D', '#F472B6', '#60A5FA', '#34D399', '#F97316'];
    return Array.from({ length: 12 }).map((_, idx) => {
      const rand = seededRandom(`confetti-${idx}`);
      return {
        id: `confetti-${idx}`,
        left: 6 + rand() * 88,
        size: 6 + rand() * 6,
        color: palette[idx % palette.length],
      };
    });
  }, []);

  useEffect(() => {
    const sunLoop = Animated.loop(
      Animated.timing(sunSpin, {
        toValue: 1,
        duration: 14000,
        useNativeDriver: true,
      })
    );
    const breezeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breeze, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(breeze, {
          toValue: 0,
          duration: 2400,
          useNativeDriver: true,
        }),
      ])
    );
    sunLoop.start();
    breezeLoop.start();
    return () => {
      sunLoop.stop();
      breezeLoop.stop();
    };
  }, [breeze, sunSpin]);

  const triggerConfetti = () => {
    setShowConfetti(true);
    confettiAnim.setValue(0);
    Animated.timing(confettiAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start(() => {
      setShowConfetti(false);
      confettiAnim.setValue(0);
    });
  };

  const triggerPlantAnimation = (dateKey) => {
    setPlantedMoodKey(dateKey);
    plantAnim.setValue(0);
    Animated.spring(plantAnim, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const openMoodPicker = () => {
    const initialIndex = currentMoodIndex();
    setSelectedMoodIndex(initialIndex);
    setMoodThoughtInput(getMoodThoughtValue(selectedHealth));
    setShowMoodModal(true);
  };

  const handleOpenMoodCalendar = () => {
    setShowMoodModal(false);
    // Close the modal first so the pushed screen is visible immediately.
    setTimeout(() => {
      navigation.navigate('MoodCalendar', { returnToMoodGarden: true });
    }, 120);
  };

  const handleMoodSelect = (idx) => {
    setSelectedMoodIndex(idx);
  };

  useEffect(() => {
    if (route.params?.openMoodPicker) {
      openMoodPicker();
      navigation.setParams({ openMoodPicker: false });
    }
  }, [navigation, route.params?.openMoodPicker]);

  const handleMoodSave = async () => {
    const idx = typeof selectedMoodIndex === 'number' ? selectedMoodIndex : currentMoodIndex();
    const normalizedThought = moodThoughtInput.trim();
    await updateHealthForDate(selectedDateISO, {
      mood: idx + 1,
      moodThought: normalizedThought || null,
    });
    triggerPlantAnimation(selectedDateISO);
    if (moodOptions[idx]?.tone === 'positive') {
      triggerConfetti();
      setTimeout(() => setShowMoodModal(false), 1200);
      return;
    }
    setShowMoodModal(false);
  };

  const formatMacroValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value}g`;
  };

  const formatFoodTime = (food) => {
    const timestamp = food?.created_at || food?.createdAt || food?.timestamp || null;
    if (!timestamp) return null;
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const renderMacroProgressRow = ({ label, total, goal, tint }) => {
    const safeTotal = Number.isFinite(total) ? total : 0;
    const safeGoal = Number.isFinite(goal) ? goal : null;
    const ratio =
      safeGoal && safeGoal > 0 ? Math.min(1, safeTotal / safeGoal) : 0;
    const displayValue = safeGoal
      ? `${Math.round(safeTotal)}/${Math.round(safeGoal)}g`
      : 'Set goal';

    return (
      <View key={label} style={styles.goalMacroRow}>
        <View style={styles.goalMacroRowHeader}>
          <Text style={[styles.goalMacroLabel, { color: themeColors.text }]}>
            {label}
          </Text>
          <Text style={[styles.goalMacroValue, { color: themeColors.textSecondary }]}>
            {displayValue}
          </Text>
        </View>
        <View
          style={[
            styles.goalMacroTrack,
            { backgroundColor: themeColors.border },
          ]}
        >
          <View
            style={[
              styles.goalMacroFill,
              {
                backgroundColor: tint,
                width: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
              },
            ]}
          />
        </View>
      </View>
    );
  };

  const normalizeHistoryFood = (food, dateKey) => {
    if (!food) return null;
    const timestamp = food.timestamp || food.created_at || food.createdAt || null;
    return {
      ...food,
      date: food.date || dateKey || '',
      timestamp,
      proteinGrams:
        food.proteinGrams ?? food.protein_grams ?? food.protein ?? null,
      carbsGrams: food.carbsGrams ?? food.carbs_grams ?? food.carbs ?? null,
      fatGrams: food.fatGrams ?? food.fat_grams ?? food.fat ?? null,
    };
  };

  const foodHistory = useMemo(() => {
    const entries = [];
    Object.entries(healthData || {}).forEach(([dateKey, day]) => {
      (day?.foods || []).forEach((food) => {
        const normalized = normalizeHistoryFood(food, dateKey);
        if (!normalized?.name) return;
        const timestampValue = normalized.timestamp
          ? new Date(normalized.timestamp).getTime()
          : null;
        const dateValue = normalized.date ? new Date(normalized.date).getTime() : null;
        entries.push({
          ...normalized,
          sortTime: timestampValue ?? dateValue ?? 0,
        });
      });
    });

    entries.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));

    const seen = new Set();
    const deduped = [];
    entries.forEach((item) => {
      const key = item.id || item.timestamp || `${item.name}-${item.calories}-${item.date}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(item);
    });
    return deduped;
  }, [healthData]);

  const formatHistoryDate = (item) => {
    const raw = item?.timestamp || item?.date;
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return String(raw);
    const dateLabel = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const timeLabel = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${dateLabel} • ${timeLabel}`;
  };

  const formatMacroRemainingValue = (value) => {
    if (value === null || value === undefined) return '--';
    const rounded = Math.round(Number(value));
    if (!Number.isFinite(rounded)) return '--';
    return `${Math.max(0, rounded)}g`;
  };

  const formatMacroGoals = (health) => {
    const proteinGoal = Number.isFinite(health.proteinGoal) ? health.proteinGoal : defaultProteinGoal;
    const carbsGoal = Number.isFinite(health.carbsGoal) ? health.carbsGoal : defaultCarbsGoal;
    const fatGoal = Number.isFinite(health.fatGoal) ? health.fatGoal : defaultFatGoal;
    const hasAnyGoal = [proteinGoal, carbsGoal, fatGoal].some((g) => g !== null);
    if (!hasAnyGoal) return 'Not set';

    const formatGoal = (value, label) =>
      `${label} ${Number.isFinite(value) ? `${value}g` : '--'}`;
    return [
      formatGoal(proteinGoal, 'P'),
      formatGoal(carbsGoal, 'C'),
      formatGoal(fatGoal, 'F'),
    ].join(' • ');
  };

  const getDailyHealthTip = ({ caloriesRemainingValue, dailyGoal, macroRemainders, dateKey }) => {
    if (!dailyGoal) {
      return 'Set a calorie goal to get a daily tip.';
    }
    if (caloriesRemainingValue <= 0) {
      return 'You are at your calorie goal. Keep it light and hydrate.';
    }
    if (caloriesRemainingValue < 200) {
      return 'Keep the rest of the day light: lean protein and veggies.';
    }

    const macroPriority = [
      { key: 'protein', value: macroRemainders.protein, label: 'protein' },
      { key: 'carbs', value: macroRemainders.carbs, label: 'carbs' },
      { key: 'fat', value: macroRemainders.fat, label: 'healthy fats' },
    ].filter((item) => item.value !== null);

    if (macroPriority.length > 0) {
      const top = macroPriority.reduce((best, item) =>
        best.value >= item.value ? best : item
      );
      if (top.value > 0) {
        return `Focus on ${top.label} to stay on track today.`;
      }
    }

    const tips = [
      'Plan your next meal with whole foods to stay on target.',
      'Add color to your plate with veggies or fruit.',
      'Keep a steady pace with smaller, balanced meals.',
      'Pair carbs with protein for steady energy.',
      'Prep a simple snack so you do not overshoot later.',
    ];
    const seed = (dateKey || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const index = tips.length ? seed % tips.length : 0;
    return tips[index] || tips[0];
  };

  const formatWeightManagerMacro = (value) => {
    if (!Number.isFinite(value)) return '--';
    return `${value} g`;
  };

  const renderWeightManagerBodyType = () => {
    const accent = healthTheme.calorie.title;
    if (!weightManagerTargetBody) {
      return (
        <View style={[styles.weightManagerBodyPlaceholder, { borderColor: accent }]}>
          <Text style={[styles.weightManagerBodyPlaceholderText, { color: accent }]}>?</Text>
        </View>
      );
    }

    const silhouette = weightManagerTargetBody.silhouette || {};
    const scale = 0.6;
    const widthFor = (value, fallback) => Math.max(18, Math.round((value || fallback) * scale));

    return (
      <View style={styles.weightManagerBodyPreview}>
        <View style={[styles.weightManagerBodyHead, { backgroundColor: accent }]} />
        <View
          style={[
            styles.weightManagerBodyShoulders,
            { backgroundColor: accent, width: widthFor(silhouette.shoulders, 40) },
          ]}
        />
        <View
          style={[
            styles.weightManagerBodyTorso,
            { backgroundColor: accent, width: widthFor(silhouette.torso, 32) },
          ]}
        />
        <View
          style={[
            styles.weightManagerBodyWaist,
            { backgroundColor: accent, width: widthFor(silhouette.waist, 28) },
          ]}
        />
        <View
          style={[
            styles.weightManagerBodyLegs,
            { backgroundColor: accent, width: widthFor(silhouette.waist, 28) },
          ]}
        />
      </View>
    );
  };

  const formatWaterLitres = (value) => {
    const num = Math.round((Number(value) || 0) * 100) / 100;
    return `${num}`;
  };

  const macroRemainingText = hasMacroGoals
    ? `P ${formatMacroRemainingValue(macroRemaining.protein)} | C ${formatMacroRemainingValue(macroRemaining.carbs)} | F ${formatMacroRemainingValue(macroRemaining.fat)}`
    : 'Set macro goals to see what is left.';

  const healthTip = getDailyHealthTip({
    caloriesRemainingValue: caloriesRemaining,
    dailyGoal: dailyCalorieGoal,
    macroRemainders: macroRemaining,
    dateKey: selectedDateISO,
  });
  const goalStatTints = {
    goal: {
      bg: isDark ? '#0F2A1F' : '#E8F9EF',
      text: isDark ? '#6EE7B7' : '#16A34A',
    },
    eaten: {
      bg: isDark ? '#162438' : '#EAF2FF',
      text: isDark ? '#7DD3FC' : '#2563EB',
    },
    left: {
      bg: isDark ? '#3A2716' : '#FFF1E5',
      text: isDark ? '#FDBA74' : '#F97316',
    },
  };
  const macroTints = {
    protein: isDark ? '#60A5FA' : '#3B82F6',
    carbs: isDark ? '#FDBA74' : '#F97316',
    fat: isDark ? '#34D399' : '#10B981',
  };

  const cardWidthStyle = swipeCardWidth ? { width: swipeCardWidth } : null;
  const swipeCardStyle = swipeCardWidth ? styles.swipeCard : null;
  const handleWeightManagerPress = () => {
    navigation.navigate('WeightManager');
  };

  const calorieTrackerCard = (
    <Card
      style={[
        styles.sectionCard,
        styles.calorieCard,
        swipeCardStyle,
        cardWidthStyle,
        {
          backgroundColor: healthTheme.calorie.card,
          borderColor: healthTheme.calorie.border,
        },
      ]}
      onPress={() => setShowGoalModal(true)}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: healthTheme.calorie.title }]}>
          Calorie Tracker
        </Text>
        <TouchableOpacity
          onPress={() => setShowGoalModal(true)}
          style={[
            styles.calorieEditButton,
            { backgroundColor: healthTheme.calorie.ringBg },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={healthTheme.calorie.title}
            style={styles.calorieEditIcon}
          />
          <Text style={[styles.calorieEditText, { color: healthTheme.calorie.title }]}>
            Edit
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.calorieRow}>
        <View style={styles.calorieLeft}>
          <View style={styles.calorieStat}>
            <Text style={[styles.calorieLabel, { color: healthTheme.calorie.label }]}>
              Daily Goal
            </Text>
            <Text style={[styles.calorieValue, { color: healthTheme.calorie.goal }]}>
              {dailyCalorieGoal} cal
            </Text>
          </View>
          <View style={styles.calorieStat}>
            <Text style={[styles.calorieLabel, { color: healthTheme.calorie.label }]}>
              Consumed
            </Text>
            <Text style={[styles.calorieValue, { color: healthTheme.calorie.consumed }]}>
              {caloriesConsumed} cal
            </Text>
          </View>
        </View>
        <View style={styles.calorieRight}>
          <View
            style={[
              styles.remainingCircle,
              {
                width: calorieCircleSize,
                height: calorieCircleSize,
                borderColor: healthTheme.calorie.ring,
                backgroundColor: healthTheme.calorie.ringBg,
              },
            ]}
          >
            <Text
              style={[
                styles.remainingText,
                { color: healthTheme.calorie.ring },
              ]}
            >
              {Math.max(caloriesRemaining, 0)} cal
            </Text>
            <Text style={[styles.remainingSub, { color: healthTheme.calorie.ring }]}>
              Remaining
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.macroGoalSummary}>
        <Text style={[styles.calorieLabel, { color: healthTheme.calorie.label }]}>
          Macro goals
        </Text>
        <Text style={[styles.calorieValue, { color: healthTheme.calorie.goal }]}>
          {formatMacroGoals(selectedHealth)}
        </Text>
      </View>
      <View style={styles.macroRemainingSummary}>
        <Text style={[styles.calorieLabel, { color: healthTheme.calorie.label }]}>
          Macros left
        </Text>
        <Text style={[styles.calorieValue, { color: healthTheme.calorie.goal }]}>
          {macroRemainingText}
        </Text>
      </View>
      <View
        style={[
          styles.healthTip,
          { backgroundColor: healthTheme.calorie.ringBg },
        ]}
      >
        <Text style={[styles.healthTipLabel, { color: healthTheme.calorie.label }]}>
          Tip
        </Text>
        <Text style={[styles.healthTipText, { color: healthTheme.calorie.title }]}>
          {healthTip}
        </Text>
      </View>
    </Card>
  );

  const weightManagerCard = (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handleWeightManagerPress}
    >
      <Card
        style={[
          styles.sectionCard,
          styles.weightManagerCard,
          styles.swipeCard,
          cardWidthStyle,
          {
            backgroundColor: healthTheme.calorie.card,
            borderColor: healthTheme.calorie.border,
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: healthTheme.calorie.title }]}>
            Weight Manager
          </Text>
          <View
            style={styles.weightManagerBadge}
          >
            <Ionicons
              name="barbell"
              size={12}
              color="#FFFFFF"
              style={styles.weightManagerBadgeIcon}
            />
            <Text style={styles.weightManagerBadgeText}>
              Available
            </Text>
          </View>
        </View>
        <Text style={[styles.weightManagerSubtitle, { color: healthTheme.calorie.label }]}>
          {weightManagerTargetBody?.label
            ? `Target: ${weightManagerTargetBody.label}`
            : 'Set your target body type'}
        </Text>

        {!weightManagerPlan && (
          <Text style={[styles.weightManagerEmpty, { color: healthTheme.calorie.label }]}>
            Add your current and target weights to unlock daily targets.
          </Text>
        )}

        <View style={styles.weightManagerRow}>
          <View style={styles.weightManagerWeights}>
            <View style={styles.weightManagerTypeRow}>
              {renderWeightManagerBodyType()}
              <View style={styles.weightManagerTypeText}>
                <Text style={[styles.weightManagerLabel, { color: healthTheme.calorie.label }]}>
                  Target type
                </Text>
                <Text style={[styles.weightManagerValue, { color: healthTheme.calorie.title }]}>
                  {weightManagerTargetBody?.label || '--'}
                </Text>
              </View>
            </View>
            <View style={styles.weightManagerStat}>
              <Text style={[styles.weightManagerLabel, { color: healthTheme.calorie.label }]}>
                Starting
              </Text>
              <Text style={[styles.weightManagerValue, { color: healthTheme.calorie.title }]}>
                {weightManagerStartingDisplay}
              </Text>
            </View>
            <View style={styles.weightManagerStat}>
              <Text style={[styles.weightManagerLabel, { color: healthTheme.calorie.label }]}>
                Current
              </Text>
              <Text style={[styles.weightManagerValue, { color: healthTheme.calorie.title }]}>
                {weightManagerCurrentDisplay}
              </Text>
            </View>
            <View style={styles.weightManagerStat}>
              <Text style={[styles.weightManagerLabel, { color: healthTheme.calorie.label }]}>
                Target
              </Text>
              <Text style={[styles.weightManagerValue, { color: healthTheme.calorie.title }]}>
                {weightManagerTargetDisplay}
              </Text>
            </View>
          </View>

          <View style={styles.weightManagerTarget}>
            <View
              style={[
                styles.weightManagerTargetRing,
                {
                  borderColor: healthTheme.calorie.ring,
                  backgroundColor: healthTheme.calorie.ringBg,
                },
              ]}
            >
              <Text style={[styles.weightManagerTargetValue, { color: healthTheme.calorie.ring }]}>
                {weightManagerPlan?.targetCalories ?? '--'}
              </Text>
              <Text style={[styles.weightManagerTargetLabel, { color: healthTheme.calorie.label }]}>
                cal/day
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.weightManagerMacroRow,
            { backgroundColor: healthTheme.calorie.ringBg },
          ]}
        >
          <View style={styles.weightManagerMacroItem}>
            <Text style={[styles.weightManagerMacroLabel, { color: healthTheme.calorie.label }]}>
              Protein
            </Text>
            <Text style={[styles.weightManagerMacroValue, { color: healthTheme.calorie.title }]}>
              {formatWeightManagerMacro(weightManagerPlan?.proteinGrams)}
            </Text>
          </View>
          <View style={styles.weightManagerMacroItem}>
            <Text style={[styles.weightManagerMacroLabel, { color: healthTheme.calorie.label }]}>
              Carbs
            </Text>
            <Text style={[styles.weightManagerMacroValue, { color: healthTheme.calorie.title }]}>
              {formatWeightManagerMacro(weightManagerPlan?.carbsGrams)}
            </Text>
          </View>
          <View style={styles.weightManagerMacroItem}>
            <Text style={[styles.weightManagerMacroLabel, { color: healthTheme.calorie.label }]}>
              Fat
            </Text>
            <Text style={[styles.weightManagerMacroValue, { color: healthTheme.calorie.title }]}>
              {formatWeightManagerMacro(weightManagerPlan?.fatGrams)}
            </Text>
          </View>
        </View>

        <View style={styles.weightManagerFooter}>
          <Text style={[styles.weightManagerAction, { color: healthTheme.calorie.title }]}>
            Tap to open weight manager
          </Text>
          <Ionicons name="chevron-forward" size={18} color={healthTheme.calorie.title} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: healthTheme.background },
      ]}
    >
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Health</Text>
          <Text style={styles.pageSubtitle}>Track sleep, nutrition, water, mood, and steps</Text>
        </View>

        <View style={styles.dateSwitcher}>
          <TouchableOpacity
            style={styles.dateSwitchButton}
            onPress={() => setSelectedDate((prev) => {
              const d = new Date(prev);
              d.setDate(prev.getDate() - 1);
              return d;
            })}
          >
            <Ionicons name="chevron-back" size={18} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={styles.dateLabel}>
            {selectedDate.toDateString() === new Date().toDateString()
              ? 'Today'
              : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
          <TouchableOpacity
            style={styles.dateSwitchButton}
            onPress={() => setSelectedDate((prev) => {
              const d = new Date(prev);
              d.setDate(prev.getDate() + 1);
              return d;
            })}
          >
            <Ionicons name="chevron-forward" size={18} color={themeColors.text} />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Card
            style={[
              styles.statCard,
              {
                backgroundColor: healthTheme.stats.water.card,
                borderColor: healthTheme.stats.water.border,
              },
            ]}
          >
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: healthTheme.stats.water.iconBg },
              ]}
            >
              <Ionicons name="water" size={18} color={healthTheme.stats.water.iconColor} />
            </View>
            <Text style={[styles.statLabel, { color: healthTheme.stats.water.label }]}>
              Avg Water
            </Text>
            <Text style={[styles.statValue, { color: waterValueColor }]}>
              {formatWaterLitres(getAverageWater())} L
            </Text>
            <Text style={[styles.statGoal, { color: healthTheme.stats.water.goal }]}>
              Over 7 days
            </Text>
          </Card>
          <Card
            style={[
              styles.statCard,
              {
                backgroundColor: healthTheme.stats.sleep.card,
                borderColor: healthTheme.stats.sleep.border,
              },
            ]}
          >
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: healthTheme.stats.sleep.iconBg },
              ]}
            >
              <Ionicons name="moon" size={18} color={healthTheme.stats.sleep.iconColor} />
            </View>
            <Text style={[styles.statLabel, { color: healthTheme.stats.sleep.label }]}>
              Avg Sleep
            </Text>
            <Text style={[styles.statValue, { color: sleepValueColor }]}>
              {getAverageSleep()} hours
            </Text>
            <Text style={[styles.statGoal, { color: healthTheme.stats.sleep.goal }]}>
              Goal: {profile.dailySleepGoal} hours/night
            </Text>
          </Card>
        </View>

        {/* Calorie Tracker Section */}
        <View style={[styles.swipeSection, { width: swipeCardWidth }]}>
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleSwipeEnd}
            scrollEventThrottle={16}
            style={{ width: swipeCardWidth }}
          >
            {calorieTrackerCard}
            {weightManagerCard}
          </Animated.ScrollView>
          <View style={styles.swipeDots}>
            <View
              style={[
                styles.swipeDot,
                healthSwipeIndex === 0 && styles.swipeDotActive,
              ]}
            />
            <View
              style={[
                styles.swipeDot,
                healthSwipeIndex === 1 && styles.swipeDotActive,
              ]}
            />
          </View>
        </View>

        {/* Mood Section */}
        <Card
          style={[
            styles.sectionCard,
            styles.moodOverviewCard,
            { backgroundColor: 'transparent', borderColor: healthTheme.mood.border },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={openMoodPicker}
            style={styles.moodTouchable}
          >
            <LinearGradient
              colors={healthTheme.mood.overviewGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.moodOverviewGradient}
              pointerEvents="none"
            />

            <View style={styles.moodOverviewHeader}>
              <View style={styles.moodOverviewLeft}>
                <View
                  style={[
                    styles.moodOverviewIcon,
                    { backgroundColor: healthTheme.mood.iconBg },
                  ]}
                >
                  <Ionicons name="flower" size={14} color={healthTheme.mood.title} />
                </View>
                <View>
                  <Text style={[styles.moodOverviewTitle, { color: themeColors.text }]}>
                    Mood Garden
                  </Text>
                  <Text style={[styles.moodOverviewSubtitle, { color: healthTheme.mood.text }]}>
                    How are you feeling?
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.moodPreviewCard,
                { borderColor: healthTheme.mood.previewBorder },
              ]}
            >
              <LinearGradient
                colors={healthTheme.mood.previewGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.moodPreviewGradient}
              >
                {miniGardenFlowers.length ? (
                  <View style={styles.moodPreviewRow}>
                    {miniGardenFlowers.map((flower, idx) => (
                      <View key={`${flower.key}-${idx}`} style={styles.moodPreviewFlower}>
                        <View
                          style={[
                            styles.moodPreviewHead,
                            { backgroundColor: flower.color },
                          ]}
                        >
                          <Text style={styles.moodPreviewEmoji}>{flower.emoji}</Text>
                        </View>
                        <View style={styles.moodPreviewStem} />
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.moodPlaceholder, { color: healthTheme.mood.text }]}>
                    Tap to plant your first flower.
                  </Text>
                )}
              </LinearGradient>
            </View>

            <View style={styles.moodFooterRow}>
              <Text style={[styles.moodFooterHint, { color: healthTheme.mood.text }]}>
                Tap to plant today's mood
              </Text>
              <Text style={[styles.moodFooterCount, { color: healthTheme.mood.count }]}>
                {totalMoodCount} flowers planted
              </Text>
            </View>
          </TouchableOpacity>
        </Card>

        {/* Steps Section */}
        <Card
          style={[
            styles.sectionCard,
            { backgroundColor: themeColors.card, borderColor: themeColors.border },
          ]}
          onPress={() => navigation.navigate('Steps', { dateISO: selectedDateISO })}
        >
          <View style={styles.logHeaderRow}>
            <View style={[styles.logIconWrap, { backgroundColor: themeColors.primaryLight }]}>
              <Ionicons name="walk" size={18} color={themeColors.primary} />
            </View>
            <View style={styles.logHeaderText}>
              <Text style={[styles.logTitle, { color: themeColors.text }]}>Steps</Text>
              <Text style={styles.logSubtitle}>
                {selectedHealthMetric?.source
                  ? `${formatStepsDateLabel(selectedDate)} • ${selectedHealthMetric.source}`
                  : formatStepsDateLabel(selectedDate)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.primary} />
          </View>
          <Text style={[styles.stepsOverviewValue, { color: themeColors.text }]}>
            {formatStepsNumber(selectedStepsTotal)}
          </Text>
          <View style={styles.logActionRow}>
            <Text style={styles.logActionText}>
              {selectedDailyStepsGoal
                ? `Goal ${formatStepsNumber(selectedDailyStepsGoal)} steps/day`
                : 'Tap to view details and set your daily goal'}
            </Text>
            <Text style={[styles.logPercentText, { color: themeColors.primary }]}>
              {selectedDailyStepsGoal ? `${selectedStepsGoalProgress}%` : 'goal'}
            </Text>
          </View>
        </Card>

        {/* Sleep Section */}
        <Card
          style={[
            styles.sectionCard,
            { backgroundColor: healthTheme.sleep.card, borderColor: healthTheme.sleep.border },
          ]}
          onPress={() => navigation.navigate('SleepLog', { dateISO: selectedDateISO })}
        >
          <View style={styles.logHeaderRow}>
            <View style={[styles.logIconWrap, { backgroundColor: healthTheme.stats.sleep.iconBg }]}>
              <Ionicons name="moon" size={18} color={healthTheme.stats.sleep.iconColor} />
            </View>
            <View style={styles.logHeaderText}>
              <Text style={[styles.logTitle, { color: healthTheme.sleep.title }]}>Sleep Tracker</Text>
              <Text style={styles.logSubtitle}>
                {sleepDurationHours !== null ? `${sleepDurationHours} hrs logged` : 'No data today'}
              </Text>
            </View>
            <Ionicons name="moon-outline" size={18} color={healthTheme.sleep.title} />
          </View>

          <View style={styles.sleepDotsRow}>
            {sleepWeek.map((day) => (
              <View
                key={day.key}
                style={[
                  styles.sleepDot,
                  {
                    backgroundColor: day.hasData
                      ? healthTheme.sleep.title
                      : healthTheme.sleep.logBorder,
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.logActionRow}>
            <Text style={styles.logActionText}>Tap to log sleep</Text>
            <Text style={[styles.logPercentText, { color: healthTheme.sleep.title }]}>
              {sleepWeekAverage !== null ? `${sleepWeekAverage} hr avg` : '7 day average'}
            </Text>
          </View>
        </Card>

        {/* Water Intake Section */}
        <Card
          style={[
            styles.sectionCard,
            styles.lastCard,
            { backgroundColor: healthTheme.water.card, borderColor: healthTheme.water.border },
          ]}
          onPress={() => navigation.navigate('WaterLog')}
        >
          <View style={styles.logHeaderRow}>
            <View style={[styles.logIconWrap, { backgroundColor: healthTheme.stats.water.iconBg }]}>
              <Ionicons name="water" size={18} color={healthTheme.stats.water.iconColor} />
            </View>
            <View style={styles.logHeaderText}>
              <Text style={[styles.logTitle, { color: healthTheme.water.title }]}>Water Intake</Text>
              <Text style={styles.logSubtitle}>
                {waterGoalMl > 0
                  ? `${waterTotalMl}ml / ${waterGoalMl}ml`
                  : `${waterTotalMl}ml logged`}
              </Text>
            </View>
            <Ionicons name="trending-up" size={18} color={healthTheme.water.title} />
          </View>

          <View style={[styles.logProgressBar, { backgroundColor: healthTheme.water.progressBg }]}>
            <View
              style={[
                styles.logProgressFill,
                { backgroundColor: healthTheme.water.progressFill },
                { width: `${Math.min(100, Math.max(0, waterProgress * 100))}%` },
              ]}
            />
          </View>

          <View style={styles.logActionRow}>
            <Text style={styles.logActionText}>Tap to add water</Text>
            <Text style={[styles.logPercentText, { color: healthTheme.water.count }]}>
              {waterGoalMl > 0 ? `${waterPercent}%` : '--'}
            </Text>
          </View>
        </Card>
      </PlatformScrollView>

      {/* Daily Goals Modal */}
      <Modal
        visible={showGoalModal}
        onClose={handleCancelNutritionGoals}
        title="Daily Goals"
        fullScreen
        hideHeader
        contentStyle={styles.goalModalScroll}
        contentContainerStyle={styles.goalModalContent}
      >
        <View style={styles.goalHero}>
          <LinearGradient
            colors={healthTheme.calorie.heroGradient}
            style={[
              styles.goalHeroGradient,
              { paddingTop: spacing.xl + insets.top },
            ]}
          >
            <View style={styles.goalHeroHeader}>
              <TouchableOpacity
                style={styles.goalHeroIconButton}
                onPress={handleCancelNutritionGoals}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.goalHeroTitleWrap}>
                <Text style={styles.goalHeroTitle}>Calorie Tracker</Text>
                <Text style={styles.goalHeroSubtitle}>Track your daily nutrition</Text>
              </View>
              <TouchableOpacity
                style={styles.goalHeroIconButton}
                onPress={handleSaveNutritionGoals}
                disabled={isSavingGoals}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="checkmark" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.goalSummaryCard}>
          <View style={[styles.goalRingWrap, styles.goalRingWrapCard]}>
            <View
              style={[
                styles.goalRing,
                {
                  borderColor: themeColors.border || colors.border,
                  backgroundColor: themeColors.inputBackground || colors.inputBackground,
                },
              ]}
            >
              <View style={[styles.goalRingIcon, { backgroundColor: themeColors.card || colors.card }]}>
                <Ionicons name="flame" size={18} color="#F97316" />
              </View>
              <Text style={[styles.goalRingValue, { color: themeColors.text }]}>
                {caloriesConsumed}
              </Text>
              <Text style={[styles.goalRingSub, { color: themeColors.textSecondary }]}>
                of {dailyCalorieGoal || 0} cal
              </Text>
            </View>
          </View>

          <View style={[styles.goalStatsRow, styles.goalStatsRowInner]}>
            <View style={[styles.goalStatCard, { backgroundColor: goalStatTints.goal.bg }]}>
              <Text style={[styles.goalStatLabel, { color: themeColors.textSecondary }]}>
                Goal
              </Text>
              <Text style={[styles.goalStatValue, { color: goalStatTints.goal.text }]}>
                {dailyCalorieGoal || 0}
              </Text>
              <Text style={[styles.goalStatUnit, { color: themeColors.textSecondary }]}>
                cal
              </Text>
            </View>
            <View style={[styles.goalStatCard, { backgroundColor: goalStatTints.eaten.bg }]}>
              <Text style={[styles.goalStatLabel, { color: themeColors.textSecondary }]}>
                Eaten
              </Text>
              <Text style={[styles.goalStatValue, { color: goalStatTints.eaten.text }]}>
                {caloriesConsumed}
              </Text>
              <Text style={[styles.goalStatUnit, { color: themeColors.textSecondary }]}>
                cal
              </Text>
            </View>
            <View style={[styles.goalStatCard, { backgroundColor: goalStatTints.left.bg }]}>
              <Text style={[styles.goalStatLabel, { color: themeColors.textSecondary }]}>
                Left
              </Text>
              <Text style={[styles.goalStatValue, { color: goalStatTints.left.text }]}>
                {Math.max(caloriesRemaining, 0)}
              </Text>
              <Text style={[styles.goalStatUnit, { color: themeColors.textSecondary }]}>
                cal
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.addMealButtonInlineCard}
            onPress={handleOpenAddMeal}
          >
          <LinearGradient
            colors={healthTheme.calorie.buttonGradient}
            style={styles.addMealButton}
          >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addMealButtonText}>Add Meal</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.goalMacroHeader}>
            <Text style={[styles.goalSectionTitle, { color: themeColors.text }]}>
              Macronutrients
            </Text>
            <Text style={[styles.goalSectionMeta, { color: themeColors.textSecondary }]}>
              Today
            </Text>
          </View>
          {renderMacroProgressRow({
            label: 'Protein',
            total: macroTotals.protein,
            goal: macroGoals.protein,
            tint: macroTints.protein,
          })}
          {renderMacroProgressRow({
            label: 'Carbs',
            total: macroTotals.carbs,
            goal: macroGoals.carbs,
            tint: macroTints.carbs,
          })}
          {renderMacroProgressRow({
            label: 'Fat',
            total: macroTotals.fat,
            goal: macroGoals.fat,
            tint: macroTints.fat,
          })}
        </View>

        <View style={styles.goalCard}>
          <View style={styles.goalMealsHeader}>
            <Text style={[styles.goalSectionTitle, { color: themeColors.text }]}>
              Today's meals
            </Text>
            <TouchableOpacity
              style={styles.goalMealsAdd}
              onPress={handleOpenAddMeal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add" size={18} color={healthTheme.calorie.ring} />
            </TouchableOpacity>
          </View>
          {selectedHealth.foods && selectedHealth.foods.length > 0 ? (
            <View style={styles.goalMealsList}>
              {selectedHealth.foods.map((food, idx) => {
                const time = formatFoodTime(food);
                return (
                  <View
                    key={food.id || food.timestamp || `${food.name}-${idx}`}
                    style={[
                      styles.goalMealItem,
                      {
                        backgroundColor: themeColors.inputBackground || colors.inputBackground,
                        borderColor: themeColors.border || colors.border,
                      },
                    ]}
                  >
                    <View style={styles.goalMealIcon}>
                      <Ionicons name="restaurant" size={18} color={healthTheme.calorie.title} />
                    </View>
                    <View style={styles.goalMealInfo}>
                      <Text style={[styles.goalMealName, { color: themeColors.text }]}>
                        {food.name}
                      </Text>
                      <Text style={[styles.goalMealMeta, { color: themeColors.textSecondary }]}>
                        {time || 'Logged meal'}
                      </Text>
                    </View>
                    <Text style={[styles.goalMealCalories, { color: themeColors.text }]}>
                      {food.calories ?? 0} cal
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.goalEmptyText, { color: themeColors.textSecondary }]}>
              No meals logged yet.
            </Text>
          )}
        </View>

        <View style={styles.goalTipCard}>
          <Text style={[styles.goalTipLabel, { color: themeColors.textSecondary }]}>
            Nutrition Tip
          </Text>
          <Text style={[styles.goalTipText, { color: themeColors.text }]}>
            {healthTip}
          </Text>
        </View>

        <View style={[styles.goalCard, styles.goalEditorCard]}>
          <Text style={[styles.goalSectionTitle, { color: themeColors.text }]}>
            Daily goals
          </Text>
          <Text style={[styles.goalSectionSubtitle, { color: themeColors.textSecondary }]}>
            Customize your calories and macros for this day.
          </Text>
          {weightManagerIsActive ? (
            <Text style={[styles.goalSectionSubtitle, styles.journeyLockText, { color: themeColors.primary }]}>
              Active weight loss journey targets are applied automatically while your journey is active.
            </Text>
          ) : null}
          <Input
            label="Calories (cal)"
            value={calorieGoalInput}
            onChangeText={setCalorieGoalInput}
            placeholder={`${defaultCalorieGoal}`}
            keyboardType="numeric"
            containerStyle={styles.goalModalInput}
            disabled={weightManagerIsActive}
          />
          <Input
            label="Protein (g)"
            value={proteinGoalInput}
            onChangeText={setProteinGoalInput}
            placeholder="e.g., 120"
            keyboardType="decimal-pad"
            containerStyle={styles.goalModalInput}
            disabled={weightManagerIsActive}
          />
          <Input
            label="Carbs (g)"
            value={carbsGoalInput}
            onChangeText={setCarbsGoalInput}
            placeholder="e.g., 200"
            keyboardType="decimal-pad"
            containerStyle={styles.goalModalInput}
            disabled={weightManagerIsActive}
          />
          <Input
            label="Fat (g)"
            value={fatGoalInput}
            onChangeText={setFatGoalInput}
            placeholder="e.g., 60"
            keyboardType="decimal-pad"
            containerStyle={styles.goalModalInput}
            disabled={weightManagerIsActive}
          />
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={handleCancelNutritionGoals}
              disabled={isSavingGoals}
              style={styles.modalButton}
            />
            <Button
              title="Save Goals"
              onPress={handleSaveNutritionGoals}
              disabled={isSavingGoals || weightManagerIsActive}
              style={styles.modalButton}
            />
          </View>
          <TouchableOpacity
            onPress={handleClearNutritionGoals}
            disabled={isSavingGoals || weightManagerIsActive}
            style={styles.goalClearButton}
          >
            <Text style={[styles.goalClearText, { color: themeColors.textSecondary }]}>
              Clear goals
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <RNModal
        visible={showJourneyTargetPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJourneyTargetPrompt(false)}
      >
        <View style={styles.completionPromptOverlay}>
          <View
            style={[
              styles.completionPromptCard,
              {
                backgroundColor: themeColors.card,
                borderColor: themeColors.border,
              },
            ]}
          >
            <LinearGradient
              colors={healthTheme.calorie.buttonGradient}
              style={styles.completionPromptIcon}
            >
              <Ionicons name="checkmark" size={22} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.completionPromptTitle, { color: themeColors.text }]}>
              Well done your daily target is reached
            </Text>
            <Text style={[styles.completionPromptText, { color: themeColors.textSecondary }]}>
              You have hit today&apos;s calorie and macro targets for your active journey plan.
            </Text>
            <Button
              title="Close"
              onPress={() => setShowJourneyTargetPrompt(false)}
              style={styles.completionPromptButton}
            />
          </View>
        </View>
      </RNModal>

      {/* Add Meal Modal */}
      <Modal
        visible={showFoodModal}
        onClose={() => {
          setShowFoodModal(false);
          setFoodName('');
          setFoodCalories('');
          setFoodProtein('');
          setFoodCarbs('');
          setFoodFat('');
          setFoodGramsEaten('');
          setFoodBasis(null);
        }}
        title="Add Meal"
        fullScreen
      >
        <Input
          label="Food Name"
          value={foodName}
          onChangeText={setFoodName}
          placeholder="e.g., Grilled Chicken Salad"
        />

        <Input
          label="Calories"
          value={foodCalories}
          onChangeText={setFoodCalories}
          placeholder="e.g., 350"
          keyboardType="numeric"
        />

        <Input
          label="Grams eaten (optional)"
          value={foodGramsEaten}
          onChangeText={setFoodGramsEaten}
          placeholder="e.g., 75"
          keyboardType="numeric"
        />

        <View style={styles.macrosRow}>
          <Input
            label="Protein (g)"
            value={foodProtein}
            onChangeText={setFoodProtein}
            placeholder="Optional"
            keyboardType="numeric"
            containerStyle={styles.macroInput}
          />

          <Input
            label="Carbs (g)"
            value={foodCarbs}
            onChangeText={setFoodCarbs}
            placeholder="Optional"
            keyboardType="numeric"
            containerStyle={styles.macroInput}
          />

          <Input
            label="Fat (g)"
            value={foodFat}
            onChangeText={setFoodFat}
            placeholder="Optional"
            keyboardType="numeric"
            containerStyle={[styles.macroInput, styles.macroInputLast]}
          />
        </View>

        <Button
          title="Search Foods"
          icon="search-outline"
          onPress={handleOpenFoodSearch}
          style={styles.searchButton}
          variant="secondary"
        />

        <Button
          title="Scan Barcode"
          icon="barcode-outline"
          onPress={handleOpenScanner}
          style={styles.scanButton}
          variant="secondary"
        />

        <View style={styles.historySection}>
          <Text style={[styles.historyTitle, { color: themeColors.text }]}>
            History
          </Text>
          {foodHistory.length ? (
            <View>
              {foodHistory.map((food, idx) => (
                <View
                  key={food.id || food.timestamp || `${food.name}-${food.calories}-${idx}`}
                  style={[
                    styles.historyItem,
                    {
                      backgroundColor: themeColors.inputBackground,
                      borderColor: themeColors.border,
                    },
                  ]}
                >
                  <View style={styles.historyInfo}>
                    <Text style={[styles.historyName, { color: themeColors.text }]}>
                      {food.name}
                    </Text>
                    <Text style={[styles.historyMeta, { color: themeColors.textSecondary }]}>
                      {formatHistoryDate(food)}
                    </Text>
                    <Text style={[styles.historyMacros, { color: themeColors.textSecondary }]}>
                      Protein: {formatMacroValue(food.proteinGrams)} | Carbs: {formatMacroValue(food.carbsGrams)} | Fat: {formatMacroValue(food.fatGrams)}
                    </Text>
                  </View>
                  <View style={styles.historyActions}>
                    <Text style={[styles.historyCalories, { color: themeColors.text }]}>
                      {food.calories ?? 0} cal
                    </Text>
                    <Button
                      title="Relog"
                      size="small"
                      variant="outline"
                      fullWidth={false}
                      onPress={() => handleRelogFood(food)}
                      style={styles.historyRelogButton}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.historyEmpty, { color: themeColors.textSecondary }]}>
              No logged foods yet.
            </Text>
          )}
        </View>

        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowFoodModal(false);
              setFoodName('');
              setFoodCalories('');
              setFoodProtein('');
              setFoodCarbs('');
              setFoodFat('');
              setFoodGramsEaten('');
              setFoodBasis(null);
            }}
            style={styles.modalButton}
          />
          <Button
            title="Add Meal"
            onPress={handleLogFood}
            disabled={!foodName.trim()}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      {/* Food Search Modal */}
      <Modal
        visible={showFoodSearchModal}
        onClose={handleCloseFoodSearch}
        title="Search Foods"
        fullScreen
      >
        <Input
          label="Food search"
          value={foodSearchQuery}
          onChangeText={setFoodSearchQuery}
          placeholder="e.g., Chicken breast"
          autoCapitalize="none"
        />

        <Button
          title="Search"
          icon="search-outline"
          onPress={handleSearchFoods}
          loading={isSearchingFoods}
          style={styles.foodSearchActionButton}
        />

        {!foodSearchResults.length && !foodSearchMessage && (
          <Text style={[styles.foodSearchHint, { color: themeColors.textSecondary }]}>
            Search Open Food Facts and USDA FoodData Central, then tap a result to autofill.
          </Text>
        )}

        {!!foodSearchMessage && (
          <Text style={[styles.foodSearchMessage, { color: themeColors.textSecondary }]}>
            {foodSearchMessage}
          </Text>
        )}

        {!!foodSearchResults.length && (
          <View style={styles.foodSearchResults}>
            {foodSearchResults.map((food, idx) => {
              const caloriesValue = Number(food?.calories);
              const caloriesLabel = Number.isFinite(caloriesValue)
                ? `${Math.round(caloriesValue)} cal`
                : 'Calories N/A';
              const sourceLabel = food?.sourceLabel || food?.source || 'Food API';
              const servingText = food?.servingSize
                ? `Serving: ${food.servingSize}${food?.basis ? ` (${food.basis})` : ''}`
                : food?.basis
                ? `Basis: ${food.basis}`
                : null;

              return (
                <TouchableOpacity
                  key={
                    food?.id ||
                    food?.externalId ||
                    `${food?.source || 'food'}-${food?.name || 'item'}-${idx}`
                  }
                  style={[
                    styles.foodSearchItem,
                    {
                      backgroundColor: themeColors.inputBackground,
                      borderColor: themeColors.border,
                    },
                  ]}
                  onPress={() => handleSelectFoodSearchResult(food)}
                  activeOpacity={0.85}
                >
                  <View style={styles.foodSearchItemHeader}>
                    <Text style={[styles.foodSearchItemName, { color: themeColors.text }]}>
                      {food.name}
                    </Text>
                    <Text style={[styles.foodSearchItemCalories, { color: themeColors.text }]}>
                      {caloriesLabel}
                    </Text>
                  </View>
                  <Text style={[styles.foodSearchItemMeta, { color: themeColors.textSecondary }]}>
                    {sourceLabel}
                  </Text>
                  <Text style={[styles.foodSearchItemMeta, { color: themeColors.textSecondary }]}>
                    Protein: {formatMacroValue(food.proteinGrams)} | Carbs: {formatMacroValue(food.carbsGrams)} | Fat: {formatMacroValue(food.fatGrams)}
                  </Text>
                  {!!servingText && (
                    <Text style={[styles.foodSearchItemMeta, { color: themeColors.textSecondary }]}>
                      {servingText}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Button
          title="Back to Add Meal"
          variant="secondary"
          onPress={handleCloseFoodSearch}
          style={styles.foodSearchBackButton}
        />
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showScannerModal}
        onClose={handleCloseScanner}
        title="Scan Barcode"
        fullScreen
        swipeToCloseEnabled={false}
        scrollEnabled={false}
      >
        {!CameraView ? (
          <View style={styles.scannerState}>
            <Text style={styles.scannerMessageText}>
              Barcode scanner module not available. Install expo-camera and restart the app.
            </Text>
            <Button
              title="Close"
              variant="secondary"
              onPress={handleCloseScanner}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : cameraPermission?.granted !== true ? (
          <View style={styles.scannerState}>
            <Text style={styles.scannerMessageText}>Camera permission is required to scan barcodes.</Text>
            <Button
              title="Grant Permission"
              onPress={handleOpenScanner}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Close"
              variant="secondary"
              onPress={handleCloseScanner}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <View style={styles.scannerContainer}>
            <View style={styles.scannerFrame}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={(hasScanned || isLookingUpBarcode) ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code128'],
                }}
              />
              <View style={styles.scannerOverlayTop} />
              <View style={styles.scannerOverlayMiddle}>
                <View style={styles.scannerOverlaySide} />
                <View style={styles.scannerGuide} />
                <View style={styles.scannerOverlaySide} />
              </View>
              <View style={styles.scannerOverlayBottom} />
            </View>
            <Text style={styles.scannerHint}>Align the barcode within the square to auto-fill the food fields.</Text>
            {!!scannerMessage && <Text style={styles.scannerMessageText}>{scannerMessage}</Text>}
            <Button
              title="Close Scanner"
              variant="secondary"
              onPress={handleCloseScanner}
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}
      </Modal>

      {/* Mood Picker Modal */}
      <Modal
        visible={showMoodModal}
        onClose={() => setShowMoodModal(false)}
        fullScreen
        hideHeader
        contentStyle={styles.gardenModalScroll}
        contentContainerStyle={styles.gardenModalContent}
        containerStyle={{ backgroundColor: gardenTheme.card }}
      >
        <View>
          <LinearGradient
            colors={gardenTheme.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gardenHeader, { paddingTop: insets.top + spacing.lg }]}
          >
            <View style={styles.gardenHeaderRow}>
              <TouchableOpacity
                style={styles.gardenBackButton}
                onPress={() => setShowMoodModal(false)}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.gardenHeaderBadge}>
                <Ionicons name="flower" size={14} color="#FFFFFF" />
                <Text style={styles.gardenHeaderBadgeText}>
                  {totalMoodCount} flowers
                </Text>
              </View>
            </View>
            <Text style={styles.gardenTitle}>Your Mood Garden</Text>
            <Text style={styles.gardenSubtitle}>Plant a flower for each feeling</Text>
          </LinearGradient>

          <View
            style={[
              styles.gardenCard,
              { backgroundColor: gardenTheme.card, borderColor: gardenTheme.border },
            ]}
          >
            <View style={styles.gardenHealthRow}>
              <View>
                <Text style={[styles.gardenHealthLabel, { color: gardenTheme.muted }]}>
                  Garden Health
                </Text>
                <Text style={[styles.gardenHealthValue, { color: themeColors.text }]}>
                  {gardenHealthPercent}% {gardenStatus.label} {gardenStatus.emoji}
                </Text>
              </View>
            </View>

            <View style={styles.gardenScene}>
              <LinearGradient colors={gardenTheme.skyGradient} style={styles.gardenSky} />
              <Animated.View style={[styles.gardenSunOrb, { transform: [{ rotate: sunRotate }] }]}>
                <Ionicons name="sunny" size={18} color={gardenTheme.sun} />
              </Animated.View>

              {showConfetti && (
                <View style={styles.confettiLayer} pointerEvents="none">
                  {confettiPieces.map((piece) => {
                    const translateY = confettiAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 140],
                    });
                    const opacity = confettiAnim.interpolate({
                      inputRange: [0, 0.7, 1],
                      outputRange: [1, 1, 0],
                    });
                    return (
                      <Animated.View
                        key={piece.id}
                        style={[
                          styles.confettiPiece,
                          {
                            left: `${piece.left}%`,
                            width: piece.size,
                            height: piece.size,
                            backgroundColor: piece.color,
                            opacity,
                            transform: [{ translateY }],
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              )}

              {gardenFlowers.map((flower) => {
                const swayRotation = breeze.interpolate({
                  inputRange: [0, 1],
                  outputRange: [`-${flower.sway}deg`, `${flower.sway}deg`],
                });
                const isPlanted = flower.dateKey === plantedMoodKey;
                const plantScale = isPlanted
                  ? plantAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] })
                  : 1;
                return (
                  <Animated.View
                    key={`${flower.dateKey}-${flower.moodIndex}`}
                    style={[
                      styles.flowerWrap,
                      {
                        left: `${flower.left}%`,
                        top: flower.top,
                        transform: [
                          { rotate: breezeRotate },
                          { rotate: swayRotation },
                          { scale: plantScale },
                        ],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.flowerHead,
                        {
                          width: flower.size,
                          height: flower.size,
                          borderRadius: flower.size / 2,
                          backgroundColor: flower.mood?.color,
                        },
                      ]}
                    >
                      <Text style={styles.flowerEmoji}>{flower.mood?.emoji}</Text>
                    </View>
                    <View style={[styles.flowerStem, { height: flower.stemHeight }]} />
                  </Animated.View>
                );
              })}

              <LinearGradient
                colors={gardenTheme.groundGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gardenGround}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.weekCard,
              { backgroundColor: gardenTheme.card, borderColor: gardenTheme.border },
            ]}
            activeOpacity={0.9}
            onPress={handleOpenMoodCalendar}
          >
            <View style={styles.weekHeader}>
              <View style={styles.weekHeaderLeft}>
                <Ionicons name="calendar" size={16} color={themeColors.primary} />
                <Text style={[styles.weekHeaderTitle, { color: themeColors.text }]}>
                  This Week
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.weekHeaderMeta, { color: themeColors.primary }]}>
                  {weeklyMoodCount} moods logged
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={themeColors.primary}
                  style={{ marginLeft: spacing.xs }}
                />
              </View>
            </View>
            <View style={styles.weekCalendarRow}>
              {weeklyGarden.map((day) => (
                <View key={day.key} style={styles.weekDay}>
                  <View
                    style={[
                      styles.weekFlower,
                      { backgroundColor: day.mood ? day.mood.color : gardenTheme.soft },
                    ]}
                  >
                    <Text style={styles.weekFlowerEmoji}>{day.mood?.emoji || ''}</Text>
                  </View>
                  <Text style={[styles.weekLabel, { color: gardenTheme.muted }]}>{day.label}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>

          <View
            style={[
              styles.moodPickerCard,
              { backgroundColor: gardenTheme.card, borderColor: gardenTheme.border },
            ]}
          >
            <Text style={[styles.moodPickerTitle, { color: themeColors.text }]}>
              How are you feeling today?
            </Text>
            <Text style={[styles.moodPickerSubtitle, { color: gardenTheme.muted }]}>
              Select your mood to plant a flower in your garden.
            </Text>
            <View style={styles.moodPickerGrid}>
              {moodOptions.map((option, idx) => {
                const isActive = activeMoodIndex === idx;
                return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.moodPickerItem,
                        {
                          backgroundColor: isDark
                            ? moodPickerToneBackgrounds?.[option.tone] || '#2F3241'
                            : option.bg,
                          borderColor: isActive
                            ? option.accent
                            : isDark
                            ? gardenTheme.border
                            : 'transparent',
                        },
                      ]}
                      onPress={() => handleMoodSelect(idx)}
                      activeOpacity={0.85}
                    >
                    <Text style={styles.moodPickerEmoji}>{option.emoji}</Text>
                    <Text style={[styles.moodPickerLabel, { color: themeColors.text }]}>
                      {option.label}
                    </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
            <View style={styles.moodThoughtSection}>
              <Text style={[styles.moodThoughtLabel, { color: themeColors.text }]}>
                Share your thoughts
              </Text>
              <TextInput
                value={moodThoughtInput}
                onChangeText={setMoodThoughtInput}
                placeholder="Write how you feel right now..."
                placeholderTextColor={gardenTheme.muted}
                style={[
                  styles.moodThoughtInput,
                  {
                    color: themeColors.text,
                    borderColor: gardenTheme.border,
                    backgroundColor: gardenTheme.soft,
                  },
                ]}
                multiline
                maxLength={220}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setShowMoodModal(false)}
                style={styles.modalButton}
              />
              <Button
                title="Plant Flower"
                onPress={handleMoodSave}
                style={styles.modalButton}
              />
            </View>
          </View>

          <View
            style={[
              styles.insightCard,
              { backgroundColor: gardenTheme.soft, borderColor: gardenTheme.border },
            ]}
          >
            <View style={styles.insightHeader}>
              <View style={styles.insightIcon}>
                <Ionicons name="sparkles" size={16} color={themeColors.primary} />
              </View>
              <Text style={[styles.insightTitle, { color: themeColors.text }]}>
                Your Mood Insights
              </Text>
            </View>
            <Text style={[styles.insightText, { color: gardenTheme.muted }]}>
              {gardenInsight}
            </Text>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const createStyles = (themeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Platform.OS === 'android' ? '#EEE4DA' : themeColors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Platform.OS === 'android' ? spacing.sm : spacing.xl,
    paddingTop: Platform.OS === 'android' ? spacing.sm : spacing.lg,
    paddingBottom: 100,
  },
  headerRow: {
    marginBottom: Platform.OS === 'android' ? spacing.sm : spacing.md,
  },
  pageTitle: {
    ...typography.h1,
    fontSize: Platform.OS === 'android' ? 24 : 34,
    fontWeight: '700',
    color: themeColors.text,
    textTransform: Platform.OS === 'android' ? 'uppercase' : 'none',
    letterSpacing: Platform.OS === 'android' ? 1.2 : 0,
  },
  pageSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
    color: themeColors.textSecondary,
    fontSize: Platform.OS === 'android' ? 12 : typography.bodySmall.fontSize,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: Platform.OS === 'android' ? spacing.sm : spacing.lg,
    marginBottom: Platform.OS === 'android' ? spacing.sm : spacing.lg,
  },
  statCard: {
    flex: 1,
    marginHorizontal: Platform.OS === 'android' ? 2 : spacing.xs,
    padding: Platform.OS === 'android' ? spacing.sm : spacing.md,
    borderRadius: Platform.OS === 'android' ? 2 : borderRadius.lg,
    borderWidth: Platform.OS === 'android' ? 2 : 1,
  },
  statIconWrap: {
    width: Platform.OS === 'android' ? 24 : 32,
    height: Platform.OS === 'android' ? 24 : 32,
    borderRadius: Platform.OS === 'android' ? 2 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'android' ? spacing.xs : spacing.sm,
  },
  statLabel: {
    ...typography.caption,
  },
  statValue: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  statGoal: {
    ...typography.caption,
    color: themeColors.textLight,
  },
  sectionCard: {
    marginBottom: Platform.OS === 'android' ? spacing.sm : spacing.lg,
    borderRadius: Platform.OS === 'android' ? 2 : borderRadius.xl,
    borderWidth: Platform.OS === 'android' ? 2 : 1,
    overflow: 'hidden',
  },
  lastCard: {
    marginBottom: spacing.xxxl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: Platform.OS === 'android' ? spacing.sm : spacing.md,
    color: themeColors.text,
    fontSize: Platform.OS === 'android' ? 16 : typography.h3.fontSize,
    textTransform: Platform.OS === 'android' ? 'uppercase' : 'none',
  },
  logHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  logHeaderText: {
    flex: 1,
  },
  logTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  logSubtitle: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  logProgressBar: {
    height: 10,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  logProgressFill: {
    height: '100%',
  },
  logActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logActionText: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  logPercentText: {
    ...typography.caption,
    fontWeight: '700',
  },
  sleepDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sleepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  calorieEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  calorieEditIcon: {
    marginRight: spacing.xs,
  },
  calorieEditText: {
    ...typography.caption,
    fontWeight: '600',
  },
  calorieStats: {
    marginBottom: spacing.lg,
  },
  calorieStat: {
    flex: 1,
    alignItems: 'flex-start',
  },
  calorieLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
    color: themeColors.textSecondary,
  },
  calorieValue: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  calorieOverLimit: {
    color: themeColors.danger,
  },
  calorieRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  macroGoalSummary: {
    marginTop: spacing.sm,
  },
  macroRemainingSummary: {
    marginTop: spacing.sm,
  },
  healthTip: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  healthTipLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  healthTipText: {
    ...typography.bodySmall,
    lineHeight: 18,
  },
  goalModalScroll: {
    paddingHorizontal: 0,
  },
  goalModalContent: {
    paddingTop: 0,
  },
  goalHero: {
    marginBottom: spacing.lg,
  },
  goalHeroGradient: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: borderRadius.xxl,
    borderBottomRightRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  goalHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalHeroIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  goalHeroTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  goalHeroTitle: {
    ...typography.h2,
    color: '#FFFFFF',
  },
  goalHeroSubtitle: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  goalRingWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  goalRingWrapCard: {
    marginTop: 0,
  },
  goalRing: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 10,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalRingIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginBottom: spacing.xs,
  },
  goalRingValue: {
    ...typography.h2,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  goalRingSub: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: spacing.xs,
  },
  goalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginTop: -spacing.md,
    marginBottom: spacing.lg,
  },
  goalStatsRowInner: {
    paddingHorizontal: 0,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  goalSummaryCard: {
    marginHorizontal: spacing.xl,
    marginTop: -spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: themeColors.border || colors.border,
    backgroundColor: themeColors.card || colors.card,
    ...shadows.medium,
    marginBottom: spacing.lg,
  },
  goalStatCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.xs,
    ...shadows.small,
  },
  goalStatLabel: {
    ...typography.caption,
  },
  goalStatValue: {
    ...typography.h3,
    fontWeight: '700',
  },
  goalStatUnit: {
    ...typography.caption,
    marginTop: 2,
  },
  goalCard: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: themeColors.border || colors.border,
    backgroundColor: themeColors.card || colors.card,
    ...shadows.small,
    marginBottom: spacing.lg,
  },
  goalEditorCard: {
    paddingTop: spacing.lg,
  },
  goalSectionTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  goalSectionSubtitle: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  journeyLockText: {
    marginTop: 0,
  },
  goalSectionMeta: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  goalMacroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  goalMacroRow: {
    marginBottom: spacing.md,
  },
  goalMacroRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  goalMacroLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  goalMacroValue: {
    ...typography.caption,
    fontWeight: '600',
  },
  goalMacroTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  goalMacroFill: {
    height: '100%',
    borderRadius: 999,
  },
  goalMealsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  goalMealsAdd: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: themeColors.inputBackground || colors.inputBackground,
    borderWidth: 1,
    borderColor: themeColors.border || colors.border,
  },
  goalMealsList: {
    marginBottom: spacing.sm,
  },
  goalMealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  goalMealIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: themeColors.card || colors.card,
  },
  goalMealInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  goalMealName: {
    ...typography.body,
    fontWeight: '600',
  },
  goalMealMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  goalMealCalories: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  goalEmptyText: {
    ...typography.bodySmall,
    marginBottom: spacing.sm,
  },
  addMealButtonInlineCard: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: 'stretch',
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    width: '100%',
    ...shadows.medium,
  },
  addMealButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  goalTipCard: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.border || colors.border,
    backgroundColor: themeColors.inputBackground || colors.inputBackground,
    marginBottom: spacing.xl,
  },
  goalTipLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  goalTipText: {
    ...typography.bodySmall,
    lineHeight: 18,
  },
  goalModalInput: {
    marginBottom: spacing.md,
  },
  goalClearButton: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  goalClearText: {
    ...typography.caption,
  },
  completionPromptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  completionPromptCard: {
    width: '100%',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.medium,
  },
  completionPromptIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  completionPromptTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  completionPromptText: {
    ...typography.bodySmall,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  completionPromptButton: {
    alignSelf: 'stretch',
  },
  calorieLeft: {
    flex: 1,
  },
  calorieRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingCircle: {
    borderWidth: 3,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: themeColors.inputBackground,
    padding: spacing.sm,
  },
  remainingText: {
    ...typography.body,
    fontWeight: '700',
  },
  remainingSub: {
    ...typography.caption,
    marginTop: 2,
  },
  calorieCard: {
    paddingVertical: spacing.xl,
  },
  swipeSection: {
    alignSelf: 'center',
  },
  swipeCard: {
    marginBottom: spacing.md,
  },
  swipeDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  swipeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: spacing.xs,
    backgroundColor: themeColors.border,
    opacity: 0.6,
  },
  swipeDotActive: {
    backgroundColor: themeColors.primary,
    opacity: 1,
  },
  weightManagerCard: {
    paddingVertical: spacing.lg,
  },
  weightManagerSubtitle: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  weightManagerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: themeColors.primary,
  },
  weightManagerBadgeIcon: {
    marginRight: spacing.xs,
  },
  weightManagerBadgeText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  weightManagerEmpty: {
    ...typography.bodySmall,
    marginBottom: spacing.md,
  },
  weightManagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  weightManagerWeights: {
    flex: 1,
  },
  weightManagerTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  weightManagerTypeText: {
    marginLeft: spacing.sm,
  },
  weightManagerStat: {
    marginBottom: spacing.sm,
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
    marginLeft: spacing.md,
  },
  weightManagerTargetRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightManagerTargetValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  weightManagerTargetLabel: {
    ...typography.caption,
    marginTop: 2,
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
    marginBottom: spacing.md,
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
  weightManagerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weightManagerAction: {
    ...typography.bodySmall,
    fontWeight: '600',
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
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  weightManagerLockContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  weightManagerLockTitle: {
    ...typography.body,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  weightManagerLockSubtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  dateSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dateSwitchButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.full,
  },
  dateLabel: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  stepsOverviewValue: {
    ...typography.h2,
    fontWeight: '700',
    marginBottom: spacing.md,
    color: themeColors.text,
  },
  stepsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stepsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  stepsTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  stepsSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  stepsAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: themeColors.inputBackground,
  },
  stepsDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stepsDateArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: themeColors.card,
    ...shadows.small,
  },
  stepsDatePicker: {
    flex: 1,
    marginHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: themeColors.card,
  },
  stepsDateText: {
    ...typography.bodySmall,
    marginHorizontal: spacing.xs,
    fontWeight: '600',
  },
  stepsTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stepsTotalLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepsTotalValue: {
    ...typography.h3,
    fontWeight: '700',
  },
  stepsChartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  stepsWeekButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: themeColors.inputBackground,
  },
  stepsWeekButtonDisabled: {
    opacity: 0.5,
  },
  stepsWeekLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  stepsChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  stepsChartDay: {
    flex: 1,
    alignItems: 'center',
  },
  stepsBarTrack: {
    width: 20,
    height: 94,
    borderRadius: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  stepsBarFill: {
    width: '100%',
    borderRadius: 10,
  },
  stepsDayLabel: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  stepsDayValue: {
    ...typography.caption,
    marginTop: 2,
  },
  stepsWeekTotalText: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  stepsEntriesSection: {
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
    paddingTop: spacing.md,
  },
  stepsEntriesTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  stepsEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
  },
  stepsEntryValue: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  stepsEntryMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  stepsEntriesEmpty: {
    ...typography.caption,
  },
  moodTouchable: {
    padding: spacing.lg,
  },
  moodOverviewCard: {
    padding: 0,
    overflow: 'hidden',
  },
  moodOverviewGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  moodOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  moodOverviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodOverviewIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginRight: spacing.sm,
  },
  moodOverviewTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  moodOverviewSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  moodOverviewSparkle: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  moodPreviewCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  moodPreviewGradient: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  moodPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  moodPreviewFlower: {
    alignItems: 'center',
  },
  moodPreviewHead: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginBottom: 2,
  },
  moodPreviewEmoji: {
    fontSize: 14,
  },
  moodPreviewStem: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#22C55E',
  },
  moodFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moodFooterHint: {
    ...typography.caption,
  },
  moodFooterCount: {
    ...typography.caption,
    fontWeight: '700',
    color: '#EC4899',
  },
  moodHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  moodSubtle: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  moodCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: themeColors.inputBackground,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  moodCountText: {
    ...typography.caption,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  miniGardenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: spacing.xs,
  },
  miniFlower: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  miniFlowerEmoji: {
    fontSize: 16,
  },
  moodHint: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: spacing.xs,
  },
  moodPlaceholder: {
    ...typography.body,
    color: themeColors.textSecondary,
    marginTop: spacing.sm,
  },
  gardenModalScroll: {
    paddingHorizontal: 0,
  },
  gardenModalContent: {
    paddingBottom: spacing.xxxl,
  },
  gardenHeader: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: borderRadius.xxl,
    borderBottomRightRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  gardenHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gardenBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  gardenHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  gardenHeaderBadgeText: {
    ...typography.caption,
    color: '#FFFFFF',
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  gardenTitle: {
    ...typography.h2,
    color: '#FFFFFF',
  },
  gardenSubtitle: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
  },
  gardenCard: {
    marginHorizontal: spacing.xl,
    marginTop: -spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    ...shadows.medium,
  },
  gardenHealthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gardenHealthLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  gardenHealthValue: {
    ...typography.body,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  gardenSunOrb: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  gardenScene: {
    height: 220,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  gardenSky: {
    ...StyleSheet.absoluteFillObject,
  },
  gardenGround: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    height: 120,
    width: '88%',
    borderRadius: 80,
    zIndex: 1,
  },
  flowerWrap: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
  },
  flowerStem: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#22C55E',
  },
  flowerHead: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginBottom: -4,
  },
  flowerEmoji: {
    fontSize: 14,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
    borderRadius: 3,
  },
  weekCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    ...shadows.small,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weekHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekHeaderTitle: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  weekHeaderMeta: {
    ...typography.caption,
    fontWeight: '600',
  },
  weekCalendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    alignItems: 'center',
    flex: 1,
  },
  weekFlower: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  weekFlowerEmoji: {
    fontSize: 14,
  },
  weekLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
  },
  moodPickerCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    ...shadows.small,
  },
  moodPickerTitle: {
    ...typography.h3,
  },
  moodPickerSubtitle: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  moodPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  moodPickerItem: {
    width: '23%',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
  },
  moodPickerEmoji: {
    fontSize: 22,
  },
  moodPickerLabel: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  moodThoughtSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  moodThoughtLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  moodThoughtInput: {
    minHeight: 84,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodySmall,
  },
  insightCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  insightIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: themeColors.inputBackground,
    marginRight: spacing.sm,
  },
  insightTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  insightText: {
    ...typography.bodySmall,
    lineHeight: 18,
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
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  macroInput: {
    flex: 1,
    marginRight: spacing.sm,
    marginBottom: 0,
  },
  macroInputLast: {
    marginRight: 0,
  },
  searchButton: {
    marginBottom: spacing.sm,
  },
  scanButton: {
    marginBottom: spacing.md,
  },
  foodSearchActionButton: {
    marginBottom: spacing.md,
  },
  foodSearchHint: {
    ...typography.bodySmall,
    marginBottom: spacing.md,
  },
  foodSearchMessage: {
    ...typography.bodySmall,
    marginBottom: spacing.md,
  },
  foodSearchResults: {
    marginBottom: spacing.md,
  },
  foodSearchItem: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  foodSearchItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  foodSearchItemName: {
    ...typography.body,
    flex: 1,
    marginRight: spacing.sm,
  },
  foodSearchItemCalories: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  foodSearchItemMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  foodSearchBackButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  historySection: {
    marginBottom: spacing.lg,
  },
  historyTitle: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  historyEmpty: {
    ...typography.bodySmall,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  historyInfo: {
    flex: 1,
    paddingRight: spacing.md,
  },
  historyName: {
    ...typography.body,
  },
  historyMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  historyMacros: {
    ...typography.caption,
    marginTop: 2,
  },
  historyActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  historyCalories: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  historyRelogButton: {
    paddingHorizontal: spacing.md,
  },
  scannerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  scannerFrame: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 420,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: themeColors.border,
    backgroundColor: themeColors.inputBackground,
  },
  scannerOverlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scannerOverlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scannerOverlayMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '50%',
  },
  scannerOverlaySide: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scannerGuide: {
    width: '60%',
    height: '100%',
    borderWidth: 2,
    borderColor: themeColors.primary,
    borderRadius: borderRadius.md,
  },
  scannerHint: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  scannerMessageText: {
    ...typography.bodySmall,
    color: themeColors.text,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  scannerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
});

export default HealthScreen;

