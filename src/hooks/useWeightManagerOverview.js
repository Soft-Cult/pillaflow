import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import {
  DEFAULT_WEIGHT_MANAGER_UNIT,
  getWeightManagerOverview,
} from '../utils/weightManager';
import {
  getWeightManagerStateStorageKey,
  hasJourneyState,
  isJourneyPlanActive,
  normalizeWeightManagerState,
} from '../utils/weightJourneyHistory';

const useWeightManagerOverview = () => {
  const navigation = useNavigation();
  const { authUser, profile, ensureWeightManagerLogsLoaded, weightManagerLogs } = useApp();
  const [weightManagerState, setWeightManagerState] = useState(null);
  const [weightManagerIsActive, setWeightManagerIsActive] = useState(false);

  const weightManagerStorageKey = useMemo(
    () =>
      getWeightManagerStateStorageKey({
        authUserId: authUser?.id,
        profileId: profile?.id,
        profileUserId: profile?.user_id,
      }),
    [authUser?.id, profile?.id, profile?.user_id]
  );

  useEffect(() => {
    ensureWeightManagerLogsLoaded();
  }, [ensureWeightManagerLogsLoaded]);

  useEffect(() => {
    let isMounted = true;

    const loadWeightManagerState = async () => {
      const profileFallback = normalizeWeightManagerState({
        weightUnit: profile?.weightManagerUnit || DEFAULT_WEIGHT_MANAGER_UNIT,
        startingWeight: profile?.weightManagerCurrentWeight,
        currentWeight: profile?.weightManagerCurrentWeight,
        targetWeight: profile?.weightManagerTargetWeight,
        currentBodyType: profile?.weightManagerCurrentBodyType,
        targetBodyType: profile?.weightManagerTargetBodyType,
      });
      const hasActiveProfileJourney =
        Number(profile?.weightManagerTargetCalories) > 0 &&
        Number(profile?.weightManagerTargetWeight) > 0 &&
        Number(profile?.weightManagerCurrentWeight) > 0;

      try {
        const stored = await AsyncStorage.getItem(weightManagerStorageKey);
        const parsed = stored ? JSON.parse(stored) : null;
        const normalized = normalizeWeightManagerState(parsed || {}, profileFallback);
        const hasAnyState = hasJourneyState(normalized);
        const nextIsActive = isJourneyPlanActive(normalized) || hasActiveProfileJourney;
        const nextState =
          hasAnyState || hasActiveProfileJourney ? normalized : null;

        if (!isMounted) return;
        setWeightManagerState(nextState);
        setWeightManagerIsActive(nextIsActive);
      } catch (err) {
        console.log('Error loading weight manager state:', err);
        if (!isMounted) return;
        setWeightManagerState(hasActiveProfileJourney ? profileFallback : null);
        setWeightManagerIsActive(hasActiveProfileJourney);
      }
    };

    loadWeightManagerState();
    const unsubscribe = navigation?.addListener?.('focus', loadWeightManagerState);
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [
    navigation,
    profile?.weightManagerCurrentBodyType,
    profile?.weightManagerCurrentWeight,
    profile?.weightManagerTargetBodyType,
    profile?.weightManagerTargetCalories,
    profile?.weightManagerTargetWeight,
    profile?.weightManagerUnit,
    weightManagerStorageKey,
  ]);

  const overview = useMemo(
    () =>
      getWeightManagerOverview({
        state: weightManagerIsActive ? weightManagerState : null,
        logs: weightManagerLogs,
        unitFallback: profile?.weightManagerUnit || DEFAULT_WEIGHT_MANAGER_UNIT,
      }),
    [profile?.weightManagerUnit, weightManagerIsActive, weightManagerLogs, weightManagerState]
  );

  return {
    weightManagerState,
    weightManagerIsActive,
    weightManagerHasDraft: hasJourneyState(weightManagerState),
    ...overview,
  };
};

export default useWeightManagerOverview;
