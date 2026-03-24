import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';

import { borderRadius, spacing, typography, shadows } from '../utils/theme';
import { useApp } from '../context/AppContext';
import {
  loadOfferingPackages,
  getEligibleFreeTrialOfferForPackage,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  getPremiumEntitlementStatus,
  PREMIUM_PRODUCT_IDS_BY_PLATFORM,
} from '../../RevenueCat';

const featureList = [
  {
    title: 'AI agent',
    icon: 'sparkles-outline',
    iconBg: '#EFE9FF',
    iconColor: '#6D5EEA',
    subtitle: 'Get personalized planning help and smart summaries.',
  },
  {
    title: 'Weekly & Monthly Insights',
    icon: 'bulb-outline',
    iconBg: '#EAF7FF',
    iconColor: '#38BDF8',
    subtitle: 'See highlights and trends across your pillars.',
  },
  {
    title: 'Groups & collaboration',
    icon: 'people-outline',
    iconBg: '#E7F0FF',
    iconColor: '#4F80FF',
    subtitle: 'Build routines with friends and keep each other on track.',
  },
  {
    title: 'Advanced analytics',
    icon: 'analytics-outline',
    iconBg: '#E6FBF2',
    iconColor: '#22C55E',
    subtitle: 'Track patterns across health, focus, and habits.',
  },
  {
    title: 'Weight Manager',
    icon: 'barbell-outline',
    iconBg: '#ECFDF3',
    iconColor: '#10B981',
    subtitle: 'Personalized calorie + macro targets for body goals.',
  },
  {
    title: 'Finance insights & budgets',
    icon: 'wallet-outline',
    iconBg: '#ECFDF3',
    iconColor: '#10B981',
    subtitle: 'Track spending, recurring payments, and budgets.',
  },
  {
    title: 'Streak protection',
    icon: 'time-outline',
    iconBg: '#FFF7E8',
    iconColor: '#F97316',
    subtitle: "Extra cushion so a missed day won't reset your streak.",
  },
  {
    title: 'Premium badge',
    icon: 'ribbon-outline',
    iconBg: '#FFE7EF',
    iconColor: '#FB7185',
    subtitle: 'Stand out with a premium badge on your profile.',
  },
  {
    title: 'Priority support',
    icon: 'shield-checkmark-outline',
    iconBg: '#F2EAFF',
    iconColor: '#8B5CF6',
    subtitle: 'Get faster answers from the Pillaflow team.',
  },
];

const getPlatformOfferingError = () => {
  const products = PREMIUM_PRODUCT_IDS_BY_PLATFORM[Platform.OS];
  if (!products) return '';
  const platformLabel = Platform.OS === 'ios' ? 'iOS' : 'Android';
  return `RevenueCat ${platformLabel} premium must use the default offering with ${products.monthly} and ${products.annual}.`;
};

const getNumericPackagePrice = (pkg) => {
  const price = Number(pkg?.product?.price);
  return Number.isFinite(price) ? price : null;
};

const formatFallbackAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
};

const formatCurrencyAmountForPackage = (pkg, amount) => {
  const currencyCode =
    typeof pkg?.product?.currencyCode === 'string' ? pkg.product.currencyCode.trim() : '';

  if (currencyCode && typeof Intl?.NumberFormat === 'function') {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      // Fall through to string replacement below.
    }
  }

  const formattedAmount = formatFallbackAmount(amount);
  const priceString = typeof pkg?.product?.priceString === 'string' ? pkg.product.priceString : '';
  const match = priceString.match(/[-+]?\d[\d\s,.]*/);
  if (match) {
    return priceString.replace(match[0], formattedAmount);
  }

  return currencyCode ? `${currencyCode} ${formattedAmount}` : `$${formattedAmount}`;
};

const buildFreeTrialSummary = (label = '') => {
  const normalized = String(label || '').trim();
  const match = normalized.match(/^(\d+)-([a-z]+)\s+free trial$/i);
  if (!match) return normalized || 'Free trial';

  const amount = Number(match[1]);
  const unit = String(match[2] || '').toLowerCase();
  const pluralizedUnit = amount === 1 ? unit : `${unit}s`;
  return `Free for ${amount} ${pluralizedUnit}`;
};

const getAnnualSavingsLabel = (monthlyPkg, annualPkg) => {
  const monthlyPrice = getNumericPackagePrice(monthlyPkg);
  const annualPrice = getNumericPackagePrice(annualPkg);
  if (!Number.isFinite(monthlyPrice) || !Number.isFinite(annualPrice) || monthlyPrice <= 0) {
    return 'Best value';
  }

  const yearlyMonthlySpend = monthlyPrice * 12;
  if (annualPrice >= yearlyMonthlySpend) {
    return 'Best value';
  }

  const savingsPercent = Math.round(((yearlyMonthlySpend - annualPrice) / yearlyMonthlySpend) * 100);
  return savingsPercent > 0 ? `Save ${savingsPercent}%` : 'Best value';
};

const PaywallScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { isPremium, refreshRevenueCatPremium, authUser, themeName, themeColors } = useApp();
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [monthlyPackage, setMonthlyPackage] = useState(null);
  const [annualPackage, setAnnualPackage] = useState(null);
  const [monthlyTrialOffer, setMonthlyTrialOffer] = useState(null);
  const [annualTrialOffer, setAnnualTrialOffer] = useState(null);
  const [purchasingId, setPurchasingId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [entitled, setEntitled] = useState(!!isPremium);
  const [entitlementLabel, setEntitlementLabel] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [plansExpanded, setPlansExpanded] = useState(true);

  const isDark = themeName === 'dark';
  const accentColor = isDark ? '#c4b5fd' : '#9b5cff';
  const backIconColor = isDark ? '#e5e7eb' : '#3f3f46';
  const styles = useMemo(
    () => createStyles({ isDark, themeColors, accentColor }),
    [isDark, themeColors, accentColor]
  );
  const source = route.params?.source || '';
  const platformOfferingError = getPlatformOfferingError();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setLoadingError('');
      setMonthlyPackage(null);
      setAnnualPackage(null);
      setMonthlyTrialOffer(null);
      setAnnualTrialOffer(null);
      try {
        const { offering, monthly, annual } = await loadOfferingPackages(authUser?.id);
        const eligibleMonthlyTrial = monthly
          ? await getEligibleFreeTrialOfferForPackage(monthly, authUser?.id)
          : null;
        const eligibleAnnualTrial = annual
          ? await getEligibleFreeTrialOfferForPackage(annual, authUser?.id)
          : null;
        if (!mounted) return;
        setMonthlyPackage(monthly || null);
        setAnnualPackage(annual || null);
        setMonthlyTrialOffer(eligibleMonthlyTrial || null);
        setAnnualTrialOffer(eligibleAnnualTrial || null);
        if (platformOfferingError && (!offering || !monthly || !annual)) {
          setLoadingError(platformOfferingError);
        }
      } catch (err) {
        if (!mounted) return;
        setMonthlyPackage(null);
        setAnnualPackage(null);
        setMonthlyTrialOffer(null);
        setAnnualTrialOffer(null);
        setLoadingError(err?.message || 'Unable to load plans right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [authUser?.id, platformOfferingError]);

  useEffect(() => {
    let active = true;
    const syncEntitlement = async () => {
      try {
        const { isActive, entitlement } =
          (await refreshRevenueCatPremium()) || (await getPremiumEntitlementStatus(authUser?.id));
        if (!active) return;
        setEntitled(!!isActive || !!isPremium);
        setEntitlementLabel(entitlement?.productIdentifier || '');
      } catch {
        // ignore; keep existing state
      }
    };
    syncEntitlement();
    return () => {
      active = false;
    };
  }, [isPremium, refreshRevenueCatPremium]);

  useEffect(() => {
    if (selectedPlan === 'yearly' && !annualPackage && monthlyPackage) {
      setSelectedPlan('monthly');
      return;
    }

    if (selectedPlan === 'monthly' && !monthlyPackage && annualPackage) {
      setSelectedPlan('yearly');
    }
  }, [selectedPlan, annualPackage, monthlyPackage]);

  const formatPrice = (pkg) => {
    const product = pkg?.product;
    if (!product) {
      return 'Price via RevenueCat';
    }
    if (product.priceString) {
      return product.priceString;
    }
    if (product.price && product.currencyCode) {
      const formatted = Number(product.price).toFixed(2);
      return `${product.currencyCode} ${formatted}`;
    }
    return 'Price via RevenueCat';
  };

  const getRegularMonthlyPrice = (pkg, trialOffer) => {
    const recurringPrice =
      trialOffer?.subscriptionOption?.fullPricePhase?.price?.formatted ||
      pkg?.product?.defaultOption?.fullPricePhase?.price?.formatted;
    if (recurringPrice) {
      return recurringPrice;
    }
    return formatPrice(pkg);
  };

  const handlePurchase = async (pkg, purchaseOptions) => {
    if (!pkg) {
      setLoadingError('This plan is not available yet. Check your RevenueCat offering.');
      return;
    }
    if (entitled) return;
    setPurchasingId(pkg.identifier);
    setLoadingError('');
    try {
      await purchaseRevenueCatPackage(pkg, purchaseOptions);
      const status =
        (await refreshRevenueCatPremium()) || (await getPremiumEntitlementStatus(authUser?.id));
      setEntitled(!!status?.isActive || !!isPremium);
      navigation.goBack();
    } catch (err) {
      if (!err?.userCancelled) {
        setLoadingError(err?.message || 'Purchase did not complete.');
      }
    } finally {
      setPurchasingId('');
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setLoadingError('');
    try {
      await restoreRevenueCatPurchases();
      const status =
        (await refreshRevenueCatPremium()) || (await getPremiumEntitlementStatus(authUser?.id));
      setEntitled(!!status?.isActive || !!isPremium);
      navigation.goBack();
    } catch (err) {
      setLoadingError(err?.message || 'Could not restore purchases.');
    } finally {
      setRestoring(false);
    }
  };

  const getPlanHeadlinePrice = (planKey, pkg) => {
    if (planKey === 'yearly') {
      const annualPrice = getNumericPackagePrice(pkg);
      if (Number.isFinite(annualPrice)) {
        return `${formatCurrencyAmountForPackage(pkg, annualPrice / 12)} / month`;
      }
      return `${formatPrice(pkg)} / year`;
    }

    return `${formatPrice(pkg)} / month`;
  };

  const getPlanBillingLine = (planKey, pkg, priceOverride) => {
    if (!pkg) return '';
    const recurringPrice = priceOverride || formatPrice(pkg);
    if (planKey === 'yearly') {
      return `Billed as ${recurringPrice} / year`;
    }
    return '';
  };

  const getPlanRenewalSummary = (planKey, pkg, priceOverride) => {
    if (!pkg) return 'the listed price';
    const recurringPrice = priceOverride || formatPrice(pkg);
    return planKey === 'yearly' ? `${recurringPrice} / year` : `${recurringPrice} / month`;
  };

  const handlePlanPress = (planKey) => {
    if (purchasingId || entitled) return;
    setSelectedPlan(planKey);
  };

  const monthlyTrialEligible = !!monthlyTrialOffer && !entitled;
  const annualTrialEligible = !!annualTrialOffer && !entitled;
  const monthlyPurchaseOptions = monthlyTrialOffer?.subscriptionOption
    ? { subscriptionOption: monthlyTrialOffer.subscriptionOption }
    : undefined;
  const annualPurchaseOptions = annualTrialOffer?.subscriptionOption
    ? { subscriptionOption: annualTrialOffer.subscriptionOption }
    : undefined;
  const monthlyPrice = getRegularMonthlyPrice(monthlyPackage, monthlyTrialOffer);
  const annualPrice = getRegularMonthlyPrice(annualPackage, annualTrialOffer);
  const annualSavingsLabel = getAnnualSavingsLabel(monthlyPackage, annualPackage);

  const yearlyPlan = {
    key: 'yearly',
    title: 'Yearly',
    package: annualPackage,
    purchaseOptions: annualPurchaseOptions,
    trialOffer: annualTrialOffer,
    trialEligible: annualTrialEligible,
    headlinePrice: getPlanHeadlinePrice('yearly', annualPackage),
    billingLine: getPlanBillingLine('yearly', annualPackage, annualPrice),
    renewalSummary: getPlanRenewalSummary('yearly', annualPackage, annualPrice),
    trialLine: annualTrialEligible
      ? `${annualTrialOffer.label} available`
      : entitled
        ? 'Premium active on this account'
        : 'Billed yearly',
    badge: annualSavingsLabel,
  };

  const monthlyPlan = {
    key: 'monthly',
    title: 'Monthly',
    package: monthlyPackage,
    purchaseOptions: monthlyPurchaseOptions,
    trialOffer: monthlyTrialOffer,
    trialEligible: monthlyTrialEligible,
    headlinePrice: `${monthlyPrice} / month`,
    billingLine: '',
    renewalSummary: getPlanRenewalSummary('monthly', monthlyPackage, monthlyPrice),
    trialLine: monthlyTrialEligible
      ? `${monthlyTrialOffer.label} available`
      : entitled
        ? 'Premium active on this account'
        : 'Billed monthly',
    badge: '',
  };

  const plans = [yearlyPlan, monthlyPlan].filter((plan) => !!plan.package);
  const selectedPlanData = plans.find((plan) => plan.key === selectedPlan) || plans[0] || null;

  const selectedPlanSummaryTitle = loading
    ? 'Loading plans...'
    : selectedPlanData?.trialEligible
      ? `${buildFreeTrialSummary(selectedPlanData.trialOffer?.label)}, then ${selectedPlanData.renewalSummary}`
      : selectedPlanData
        ? `Start ${selectedPlanData.title.toLowerCase()} for ${selectedPlanData.renewalSummary}`
        : 'Choose a plan';

  const selectedPlanSummarySubtitle = loading
    ? 'Fetching live prices from RevenueCat.'
    : plansExpanded
      ? 'Select a plan below, then confirm with the button.'
      : 'Tap to compare plans or change your selection.';

  const billingTimelineItems = useMemo(() => {
    const defaultPlanName = selectedPlanData?.title?.toLowerCase() || 'selected';
    const renewalSummary = selectedPlanData?.renewalSummary || 'the listed price';
    const trialLabel = String(selectedPlanData?.trialOffer?.label || 'free trial').toLowerCase();

    if (selectedPlanData?.trialEligible) {
      return [
        {
          key: 'start',
          icon: 'sparkles-outline',
          title: 'Start your trial',
          detail: `Unlock every Premium feature immediately with the ${trialLabel}.`,
        },
        {
          key: 'reminder',
          icon: 'notifications-outline',
          title: 'Decide before billing',
          detail: 'You can cancel before the trial ends if it is not for you.',
        },
        {
          key: 'billing',
          icon: 'card-outline',
          title: 'Full price after the trial',
          detail: `If you keep Premium, the ${defaultPlanName} plan renews at ${renewalSummary}.`,
        },
      ];
    }

    return [
      {
        key: 'start',
        icon: 'sparkles-outline',
        title: 'Start Premium now',
        detail: `The ${defaultPlanName} plan unlocks every Premium feature right away.`,
      },
      {
        key: 'billing',
        icon: 'card-outline',
        title: 'Billing starts today',
        detail: `Your subscription renews at ${renewalSummary} until you cancel.`,
      },
    ];
  }, [selectedPlanData]);

  const purchaseButtonLabel = entitled
    ? 'Premium active'
    : selectedPlanData?.trialEligible
      ? `Try for ${formatCurrencyAmountForPackage(selectedPlanData.package, 0)}`
      : selectedPlanData?.package
        ? `Continue with ${selectedPlanData.renewalSummary}`
        : 'Plan unavailable';

  const purchaseButtonNote = entitled
    ? 'You already have Premium on this account.'
    : selectedPlanData?.trialEligible
      ? `You will not be charged until your ${String(
          selectedPlanData.trialOffer?.label || 'free trial'
        ).toLowerCase()} ends. Cancel anytime.`
      : selectedPlanData?.package
        ? `Your subscription renews at ${selectedPlanData.renewalSummary}. Cancel anytime.`
        : 'Plans will appear here once RevenueCat is connected.';

  const handlePurchasePress = () => {
    if (!selectedPlanData?.package) {
      setLoadingError('This plan is not available yet. Check your RevenueCat offering.');
      return;
    }

    handlePurchase(selectedPlanData.package, selectedPlanData.purchaseOptions);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={backIconColor} />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Image
            source={require('../../assets/adaptive-icon.png')}
            style={styles.heroIcon}
            resizeMode="contain"
          />
          <View style={styles.titleRow}>
            <View style={styles.titleSide}>
              <Text style={styles.titleText}>Pillaflow</Text>
            </View>
            <View style={[styles.titleSide, styles.titleSideRight]}>
              <Svg width={110} height={28} style={styles.titleGradient}>
                <Defs>
                  <SvgLinearGradient id="premiumGold" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#F9E7A3" />
                    <Stop offset="50%" stopColor="#E6B85C" />
                    <Stop offset="100%" stopColor="#C9922E" />
                  </SvgLinearGradient>
                </Defs>
                <SvgText x="0" y="22" fill="url(#premiumGold)" fontSize="22" fontWeight="700">
                  Premium
                </SvgText>
              </Svg>
            </View>
          </View>
          <Text style={styles.subtitle}>Unlock all premium features</Text>
          {source ? <Text style={styles.sourceNote}>Opened from: {source}</Text> : null}
          {entitled && (
            <View style={styles.entitlementPill}>
              <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
              <Text style={styles.entitlementText}>
                Active: {entitlementLabel || 'Pillaflow Premium'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.featuresTimeline}>
          <View style={styles.timelineLine} />
          {featureList.map((item) => (
            <View key={item.title} style={styles.featureTimelineRow}>
              <View style={[styles.featureDot, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={18} color={item.iconColor} />
              </View>
              <View style={styles.featureTimelineText}>
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.billingCard}>
          <Text style={styles.billingEyebrow}>How billing works</Text>
          <Text style={styles.billingTitle}>Start the trial first, then decide.</Text>
          <View style={styles.billingTimeline}>
            <View style={styles.billingTimelineLine} />
            {billingTimelineItems.map((item) => (
              <View key={item.key} style={styles.billingStepRow}>
                <View style={styles.billingStepIcon}>
                  <Ionicons name={item.icon} size={18} color={accentColor} />
                </View>
                <View style={styles.billingStepContent}>
                  <Text style={styles.billingStepTitle}>{item.title}</Text>
                  <Text style={styles.billingStepText}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.pricingSheet}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.pricingSheetHeader}
            onPress={() => setPlansExpanded((value) => !value)}
          >
            <View style={styles.pricingSheetHandle} />
            <View style={styles.pricingSheetHeaderRow}>
              <View style={styles.pricingSheetCopy}>
                <Text style={styles.pricingSheetTitle}>{selectedPlanSummaryTitle}</Text>
                <Text style={styles.pricingSheetSubtitle}>{selectedPlanSummarySubtitle}</Text>
              </View>
              <Ionicons
                name={plansExpanded ? 'chevron-down' : 'chevron-up'}
                size={20}
                color={isDark ? '#9ca3af' : '#6b7280'}
              />
            </View>
          </TouchableOpacity>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={accentColor} />
              <Text style={styles.loadingText}>Fetching plans...</Text>
            </View>
          ) : plansExpanded ? (
            <View style={styles.planStack}>
              {plans.map((plan) => {
                const selected = selectedPlan === plan.key;
                return (
                  <TouchableOpacity
                    key={plan.key}
                    activeOpacity={0.92}
                    onPress={() => handlePlanPress(plan.key)}
                    disabled={!!purchasingId || entitled}
                    style={[
                      styles.planOptionCard,
                      selected && styles.planOptionCardSelected,
                    ]}
                  >
                    {plan.badge ? (
                      <View style={styles.planOptionBadge}>
                        <Text style={styles.planOptionBadgeText}>{plan.badge}</Text>
                      </View>
                    ) : null}

                    <View style={styles.planOptionRow}>
                      <View style={styles.planOptionLeft}>
                        <View
                          style={[
                            styles.planOptionRadio,
                            selected && styles.planOptionRadioSelected,
                          ]}
                        >
                          {selected ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
                        </View>
                        <Text style={styles.planOptionLabel}>{plan.title}</Text>
                      </View>

                      <View style={styles.planOptionPriceBlock}>
                        <Text style={styles.planOptionPrice}>{plan.headlinePrice}</Text>
                        {plan.billingLine ? (
                          <Text style={styles.planOptionBilling}>{plan.billingLine}</Text>
                        ) : null}
                        <Text
                          style={[
                            styles.planOptionTrial,
                            !plan.trialEligible && styles.planOptionTrialMuted,
                          ]}
                        >
                          {plan.trialLine}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={loading || !selectedPlanData?.package || !!purchasingId || entitled}
            onPress={handlePurchasePress}
            style={styles.purchaseButtonTouch}
          >
            <LinearGradient
              colors={['#FFD86E', '#F4B544']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.purchaseButton,
                (loading || !selectedPlanData?.package || !!purchasingId || entitled) &&
                  styles.purchaseButtonDisabled,
              ]}
            >
              {purchasingId ? (
                <ActivityIndicator size="small" color="#6b3900" />
              ) : (
                <Text style={styles.purchaseButtonText}>{purchaseButtonLabel}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.purchaseNote}>{purchaseButtonNote}</Text>
        </View>

        {!!loadingError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadingError}</Text>
          </View>
        )}

        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={restoring || !!purchasingId}
            activeOpacity={0.7}
          >
            {restoring ? <ActivityIndicator size="small" color={accentColor} /> : null}
            <Text style={styles.restoreText}>
              {restoring ? 'Restoring...' : 'Restore purchases'}
            </Text>
          </TouchableOpacity>
          {entitled ? (
            <Text style={styles.smallNote}>You already have Premium on this account.</Text>
          ) : (
            <Text style={styles.smallNote}>
              Purchases are managed securely via RevenueCat. Once connected, your live prices and trials appear here.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = ({ isDark, themeColors, accentColor }) => {
  const background = isDark ? themeColors?.background || '#0f1115' : '#ffffff';
  const surface = isDark ? themeColors?.card || '#161b26' : '#ffffff';
  const text = themeColors?.text || (isDark ? '#f3f4f6' : '#111827');
  const textSecondary = themeColors?.textSecondary || (isDark ? '#9ca3af' : '#6b7280');
  const textMuted = themeColors?.textLight || (isDark ? '#94a3b8' : '#94a3b8');
  const softBorder = isDark ? '#2b3342' : '#eee7de';
  const line = isDark ? '#2c3446' : '#f1ede7';
  const backButtonBg = isDark ? '#151a24' : '#ffffff';
  const entitlementBg = isDark ? 'rgba(34,197,94,0.18)' : '#e7f8ef';
  const entitlementBorder = isDark ? 'rgba(34,197,94,0.35)' : '#bbf7d0';
  const entitlementText = isDark ? '#86efac' : '#15803d';
  const errorBg = isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2';
  const errorBorder = isDark ? 'rgba(239,68,68,0.35)' : '#fecaca';
  const errorText = isDark ? '#fca5a5' : '#991b1b';
  const sheetSurface = isDark ? '#151b25' : '#fffdfa';
  const sheetBorder = isDark ? '#2b3342' : '#ece2d6';
  const selectedPlanBg = isDark ? 'rgba(196,181,253,0.08)' : '#fbf7ff';
  const handleColor = isDark ? 'rgba(255,255,255,0.24)' : '#c9bba6';
  const badgeText = '#083344';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: softBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: backButtonBg,
      ...shadows.small,
    },
    hero: {
      alignItems: 'center',
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
    },
    heroIcon: {
      width: 56,
      height: 56,
      backgroundColor: 'transparent',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      marginTop: spacing.md,
      transform: [{ translateX: -6 }],
    },
    titleSide: {
      flex: 1,
      alignItems: 'flex-end',
    },
    titleSideRight: {
      alignItems: 'flex-start',
    },
    titleText: {
      fontSize: 22,
      fontWeight: '700',
      color: text,
      letterSpacing: 0.2,
    },
    titleGradient: {
      marginLeft: 6,
    },
    subtitle: {
      ...typography.bodySmall,
      color: textSecondary,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    sourceNote: {
      ...typography.caption,
      color: textMuted,
      marginTop: spacing.xs,
    },
    entitlementPill: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: entitlementBg,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: entitlementBorder,
    },
    entitlementText: {
      ...typography.caption,
      color: entitlementText,
      fontWeight: '600',
    },
    featuresTimeline: {
      marginTop: spacing.md,
      marginBottom: spacing.xl,
      paddingLeft: spacing.xl,
      gap: spacing.xl,
      position: 'relative',
    },
    timelineLine: {
      position: 'absolute',
      left: 37,
      top: 6,
      bottom: 6,
      width: 2,
      backgroundColor: line,
    },
    featureTimelineRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    featureDot: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.small,
    },
    featureTimelineText: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: text,
    },
    featureSubtitle: {
      fontSize: 14,
      color: textSecondary,
      marginTop: 4,
    },
    billingCard: {
      marginTop: spacing.md,
      padding: spacing.lg,
      borderRadius: borderRadius.xxl,
      backgroundColor: sheetSurface,
      borderWidth: 1,
      borderColor: sheetBorder,
      ...shadows.small,
    },
    billingEyebrow: {
      ...typography.caption,
      color: accentColor,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    billingTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: text,
      marginTop: spacing.xs,
    },
    billingTimeline: {
      marginTop: spacing.lg,
      gap: spacing.lg,
      position: 'relative',
    },
    billingTimelineLine: {
      position: 'absolute',
      left: 17,
      top: 10,
      bottom: 10,
      width: 2,
      backgroundColor: line,
    },
    billingStepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    billingStepIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#111723' : '#f8fafc',
      borderWidth: 1,
      borderColor: sheetBorder,
      zIndex: 1,
    },
    billingStepContent: {
      flex: 1,
      paddingTop: 2,
    },
    billingStepTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: text,
    },
    billingStepText: {
      ...typography.bodySmall,
      color: textSecondary,
      marginTop: 4,
      lineHeight: 20,
    },
    planStack: {
      marginTop: spacing.lg,
      gap: spacing.md,
    },
    pricingSheet: {
      marginTop: spacing.xl,
      padding: spacing.lg,
      borderRadius: borderRadius.xxl,
      backgroundColor: sheetSurface,
      borderWidth: 1,
      borderColor: sheetBorder,
      ...shadows.medium,
    },
    pricingSheetHeader: {
      alignItems: 'center',
    },
    pricingSheetHandle: {
      width: 48,
      height: 5,
      borderRadius: borderRadius.full,
      backgroundColor: handleColor,
      marginBottom: spacing.md,
    },
    pricingSheetHeaderRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    pricingSheetCopy: {
      flex: 1,
    },
    pricingSheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: text,
      lineHeight: 24,
    },
    pricingSheetSubtitle: {
      ...typography.bodySmall,
      color: textSecondary,
      marginTop: spacing.xs,
      lineHeight: 20,
    },
    planOptionCard: {
      position: 'relative',
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: softBorder,
      ...shadows.small,
    },
    planOptionCardSelected: {
      borderColor: accentColor,
      backgroundColor: selectedPlanBg,
      shadowColor: accentColor,
      shadowOpacity: 0.14,
      shadowRadius: 12,
      elevation: 4,
    },
    planOptionBadge: {
      position: 'absolute',
      top: -10,
      left: spacing.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
      backgroundColor: '#2dd4bf',
    },
    planOptionBadgeText: {
      ...typography.caption,
      color: badgeText,
      fontWeight: '700',
    },
    planOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    planOptionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    planOptionRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: softBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    planOptionRadioSelected: {
      backgroundColor: accentColor,
      borderColor: accentColor,
    },
    planOptionLabel: {
      fontSize: 18,
      fontWeight: '700',
      color: text,
    },
    planOptionPriceBlock: {
      alignItems: 'flex-end',
      flexShrink: 1,
    },
    planOptionPrice: {
      fontSize: 18,
      fontWeight: '700',
      color: text,
      textAlign: 'right',
    },
    planOptionBilling: {
      ...typography.bodySmall,
      color: textSecondary,
      marginTop: 2,
      textAlign: 'right',
    },
    planOptionTrial: {
      ...typography.bodySmall,
      color: '#14b8a6',
      marginTop: spacing.xs,
      fontWeight: '600',
      textAlign: 'right',
    },
    planOptionTrialMuted: {
      color: textSecondary,
    },
    loadingCard: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.lg,
      backgroundColor: background,
      borderWidth: 1,
      borderColor: softBorder,
      ...shadows.small,
    },
    loadingText: {
      ...typography.bodySmall,
      color: textSecondary,
      marginTop: spacing.sm,
    },
    purchaseButtonTouch: {
      marginTop: spacing.lg,
    },
    purchaseButton: {
      borderRadius: borderRadius.full,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    purchaseButtonDisabled: {
      opacity: 0.6,
    },
    purchaseButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#6b3900',
    },
    purchaseNote: {
      ...typography.bodySmall,
      color: textSecondary,
      marginTop: spacing.md,
      textAlign: 'center',
      lineHeight: 20,
    },
    errorBox: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: errorBg,
      borderWidth: 1,
      borderColor: errorBorder,
    },
    errorText: {
      ...typography.bodySmall,
      color: errorText,
    },
    footerActions: {
      marginTop: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
    },
    restoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    restoreText: {
      fontSize: 14,
      fontWeight: '600',
      color: accentColor,
    },
    smallNote: {
      ...typography.caption,
      color: textSecondary,
      textAlign: 'center',
    },
  });
};

export default PaywallScreen;
