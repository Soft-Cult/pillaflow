import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Easing,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Input from '../components/Input';
import { useApp } from '../context/AppContext';
import { colors, borderRadius, spacing, typography, shadows } from '../utils/theme';

const badges = [
  {
    id: 'habits',
    icon: 'target',
    iconType: 'feather',
    color: colors.habits,
  },
  {
    id: 'tasks',
    icon: 'edit-3',
    iconType: 'feather',
    color: colors.tasks,
  },
  {
    id: 'health',
    icon: 'heart-outline',
    iconType: 'ionicons',
    color: colors.health,
  },
  {
    id: 'home',
    icon: 'history',
    iconType: 'material',
    color: colors.routine,
  },
  {
    id: 'finance',
    icon: 'trending-up',
    iconType: 'feather',
    color: colors.finance,
  },
];

const AuthScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { signIn, hasOnboarded, themeColors, themeName } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const isDark = themeName === 'dark';
  const { width, height } = useWindowDimensions();
  const waveAnim = React.useRef(new Animated.Value(0)).current;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showWave, setShowWave] = useState(false);
  const [form, setForm] = useState({
    identifier: '',
    password: '',
  });

  const authTheme = useMemo(
    () => ({
      backgroundGradient: isDark
        ? ['#0B1020', '#0C1124', '#140F24']
        : ['#F9F0FF', '#FFF6FA', '#F5F8FF'],
      cardBg: isDark ? '#0F172A' : '#FFFFFF',
      cardBorder: isDark ? '#1F2937' : '#EDE9F5',
      inputBg: isDark ? '#0B1220' : '#FFFFFF',
      inputBorder: isDark ? '#1F2937' : '#E5E7EB',
      buttonGradient: isDark ? ['#8B5CF6', '#EC4899'] : ['#B14DFF', '#F43F8C'],
      link: isDark ? '#C084FC' : colors.primary,
      muted: themeColors.textSecondary || colors.textSecondary,
      orbOne: isDark ? 'rgba(139,92,246,0.22)' : 'rgba(236,72,153,0.16)',
      orbTwo: isDark ? 'rgba(56,189,248,0.2)' : 'rgba(59,130,246,0.12)',
    }),
    [isDark, themeColors.textSecondary]
  );

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    if (!form.identifier || !form.password) {
      setError('Please enter your email and password.');
      setIsSubmitting(false);
      return;
    }

    try {
      await signIn({
        identifier: form.identifier,
        password: form.password,
      });
    } catch (submitError) {
      setError(submitError?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    if (!hasOnboarded) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'Auth' }],
    });
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      waveAnim.setValue(0);
      setShowWave(false);
    });
    return unsubscribe;
  }, [navigation, waveAnim]);

  const handleCreateAccount = () => {
    if (showWave) return;
    setError('');
    setShowWave(true);
    waveAnim.setValue(0);
    Animated.timing(waveAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        navigation.navigate('SignupFlow');
      }
    });
  };

  const renderBadgeIcon = (badge) => {
    if (badge.iconType === 'feather') {
      return <Feather name={badge.icon} size={18} color={badge.color} />;
    }
    if (badge.iconType === 'material') {
      return <MaterialCommunityIcons name={badge.icon} size={18} color={badge.color} />;
    }
    return <Ionicons name={badge.icon} size={18} color={badge.color} />;
  };

  const isCtaDisabled = isSubmitting || !form.identifier || !form.password;
  const waveWidth = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width],
  });
  const waveRadius = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });
  const waveOpacity = waveAnim.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <LinearGradient
      colors={authTheme.backgroundGradient}
      style={[styles.container, { paddingTop: insets.top + spacing.md }]}
    >
      <View style={styles.backgroundOrbs} pointerEvents="none">
        <View style={[styles.orb, styles.orbOne, { backgroundColor: authTheme.orbOne }]} />
        <View style={[styles.orb, styles.orbTwo, { backgroundColor: authTheme.orbTwo }]} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color={themeColors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.iconRow}>
          {badges.map((badge) => (
            <View
              key={badge.id}
              style={[
                styles.badge,
                { backgroundColor: `${badge.color}1A` },
              ]}
            >
              {renderBadgeIcon(badge)}
            </View>
          ))}
        </View>

        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <View style={[styles.logoDot, { backgroundColor: colors.habits }]} />
            <View style={[styles.logoDot, { backgroundColor: colors.tasks }]} />
            <View style={[styles.logoDot, { backgroundColor: colors.health }]} />
            <View style={[styles.logoDot, { backgroundColor: colors.routine }]} />
          </View>
          <Text style={styles.logoTitle}>Pillaflow</Text>
        </View>
        <Text style={styles.subtitle}>Welcome back. Let's get you signed in.</Text>

        <View
          style={[
            styles.card,
            { backgroundColor: authTheme.cardBg, borderColor: authTheme.cardBorder },
          ]}
        >
          <View>
            <View>
              <Input
                placeholder="Email"
                icon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.identifier}
                onChangeText={(text) => updateField('identifier', text)}
                containerStyle={styles.inputGroup}
                style={[
                  styles.inputField,
                  { backgroundColor: authTheme.inputBg, borderColor: authTheme.inputBorder },
                ]}
                inputStyle={styles.inputText}
              />
              <Input
                placeholder="Password"
                icon="lock-closed-outline"
                secureTextEntry
                autoCapitalize="none"
                value={form.password}
                onChangeText={(text) => updateField('password', text)}
                containerStyle={styles.inputGroup}
                style={[
                  styles.inputField,
                  { backgroundColor: authTheme.inputBg, borderColor: authTheme.inputBorder },
                ]}
                inputStyle={styles.inputText}
              />

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={[styles.linkText, { color: authTheme.link }]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.ctaButton, isCtaDisabled && styles.ctaDisabled]}
              onPress={handleSubmit}
              disabled={isCtaDisabled}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.ctaContent,
                  { backgroundColor: authTheme.buttonGradient[0] },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>Login</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.ctaIcon} />
                  </>
                )}
              </View>
            </TouchableOpacity>

            <Text style={styles.createPrompt}>Don't have an account?</Text>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: authTheme.link }]}
              onPress={handleCreateAccount}
              activeOpacity={0.85}
            >
              <Text style={[styles.secondaryText, { color: authTheme.link }]}>
                Create an Account
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {showWave && (
        <Animated.View
          pointerEvents="auto"
          style={[
            styles.waveOverlay,
            {
              width: waveWidth,
              opacity: waveOpacity,
              borderTopLeftRadius: waveRadius,
              borderBottomLeftRadius: waveRadius,
            },
          ]}
        >
          <LinearGradient colors={authTheme.buttonGradient} style={styles.waveGradient} />
        </Animated.View>
      )}
    </LinearGradient>
  );
};

const createStyles = (themeColorsParam = colors) => {
  const baseText = themeColorsParam?.text || colors.text;
  const mutedText = themeColorsParam?.textSecondary || colors.textSecondary;
  const isAndroid = Platform.OS === 'android';
  const displayFont = Platform.select({
    ios: 'AvenirNext-DemiBold',
    android: 'sans-serif-condensed',
  });

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: isAndroid ? spacing.md : spacing.xl,
    },
    waveOverlay: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: 0,
      overflow: 'hidden',
      zIndex: 10,
    },
    waveGradient: {
      flex: 1,
    },
    backgroundOrbs: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    orb: {
      position: 'absolute',
      borderRadius: 999,
    },
    orbOne: {
      width: 220,
      height: 220,
      top: -80,
      left: -40,
    },
    orbTwo: {
      width: 180,
      height: 180,
      bottom: -40,
      right: -20,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isAndroid ? spacing.sm : spacing.md,
      alignSelf: 'flex-start',
    },
    backText: {
      ...typography.bodySmall,
      marginLeft: spacing.xs,
      color: mutedText,
    },
    iconRow: {
      flexDirection: 'row',
      justifyContent: isAndroid ? 'flex-start' : 'center',
      marginBottom: isAndroid ? spacing.sm : spacing.md,
    },
    badge: {
      width: isAndroid ? 30 : 34,
      height: isAndroid ? 30 : 34,
      borderRadius: isAndroid ? 4 : 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: isAndroid ? 2 : spacing.xs,
      ...shadows.small,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: isAndroid ? 'flex-start' : 'center',
      marginBottom: spacing.sm,
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
    logoTitle: {
      fontSize: isAndroid ? 26 : 30,
      fontWeight: '700',
      color: baseText,
      fontFamily: displayFont,
      letterSpacing: isAndroid ? 1.1 : 0,
    },
    subtitle: {
      ...typography.bodySmall,
      color: mutedText,
      textAlign: isAndroid ? 'left' : 'center',
      marginBottom: isAndroid ? spacing.md : spacing.lg,
    },
    card: {
      borderRadius: isAndroid ? 6 : borderRadius.xl,
      borderWidth: 1,
      padding: isAndroid ? spacing.md : spacing.lg,
      ...shadows.medium,
    },
    inputGroup: {
      marginBottom: isAndroid ? spacing.sm : spacing.md,
    },
    inputField: {
      borderRadius: isAndroid ? 0 : borderRadius.lg,
      borderWidth: 1,
    },
    inputText: {
      color: baseText,
    },
    forgotPassword: {
      alignSelf: isAndroid ? 'flex-start' : 'flex-end',
      marginBottom: spacing.sm,
    },
    linkText: {
      ...typography.bodySmall,
      fontWeight: '600',
    },
    errorText: {
      color: themeColorsParam?.danger || colors.danger,
      marginBottom: spacing.sm,
    },
    ctaButton: {
      borderRadius: isAndroid ? 2 : borderRadius.full,
      overflow: 'hidden',
      marginTop: spacing.sm,
      marginBottom: isAndroid ? spacing.md : spacing.lg,
    },
    ctaDisabled: {
      opacity: 0.6,
    },
    ctaContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: isAndroid ? spacing.md : spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    ctaText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
      fontFamily: displayFont,
    },
    ctaIcon: {
      marginLeft: spacing.sm,
    },
    createPrompt: {
      ...typography.bodySmall,
      color: mutedText,
      textAlign: isAndroid ? 'left' : 'center',
      marginBottom: spacing.sm,
    },
    secondaryButton: {
      borderWidth: 1,
      borderRadius: isAndroid ? 2 : borderRadius.full,
      paddingVertical: isAndroid ? spacing.sm : spacing.md,
      alignItems: 'center',
    },
    secondaryText: {
      ...typography.body,
      fontWeight: '700',
      fontFamily: displayFont,
    },
  });
};

export default AuthScreen;
