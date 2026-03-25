import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing } from '../utils/theme';
import { supabase } from '../utils/supabaseClient';
import { useApp } from '../context/AppContext';

const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = true,
  disableTranslation = false,
}) => {
  const { themeColors, t } = useApp();
  const styles = React.useMemo(() => createStyles(), [themeColors]);
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          container: styles.primaryContainer,
          text: styles.primaryText,
        };
      case 'secondary':
        return {
          container: styles.secondaryContainer,
          text: styles.secondaryText,
        };
      case 'outline':
        return {
          container: styles.outlineContainer,
          text: styles.outlineText,
        };
      case 'danger':
        return {
          container: styles.dangerContainer,
          text: styles.dangerText,
        };
      case 'success':
        return {
          container: styles.successContainer,
          text: styles.successText,
        };
      case 'ghost':
        return {
          container: styles.ghostContainer,
          text: styles.ghostText,
        };
      default:
        return {
          container: styles.primaryContainer,
          text: styles.primaryText,
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.smallContainer,
          text: styles.smallText,
        };
      case 'medium':
        return {
          container: styles.mediumContainer,
          text: styles.mediumText,
        };
      case 'large':
        return {
          container: styles.largeContainer,
          text: styles.largeText,
        };
      default:
        return {
          container: styles.mediumContainer,
          text: styles.mediumText,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const buttonStyles = [
    styles.container,
    variantStyles.container,
    sizeStyles.container,
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  const buttonTextStyles = [
    styles.text,
    variantStyles.text,
    sizeStyles.text,
    disabled && styles.disabledText,
    textStyle,
  ];

  const iconColor = variantStyles.text.color;

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <View style={styles.contentContainer}>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={size === 'small' ? 16 : 20}
              color={disabled ? colors.textLight : iconColor}
              style={styles.iconLeft}
            />
          )}
          <Text style={buttonTextStyles}>
            {typeof title === 'string' && !disableTranslation ? t(title) : title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={size === 'small' ? 16 : 20}
              color={disabled ? colors.textLight : iconColor}
              style={styles.iconRight}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      borderRadius: Platform.OS === 'android' ? 2 : borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: Platform.OS === 'android' ? 34 : undefined,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: Platform.OS === 'android' ? 'rgba(0,0,0,0.08)' : 'transparent',
    },
    contentContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: Platform.OS === 'android' ? 'flex-start' : 'center',
      width: Platform.OS === 'android' ? '100%' : undefined,
    },
    fullWidth: {
      width: '100%',
    },
    text: {
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      textTransform: Platform.OS === 'android' ? 'uppercase' : 'none',
      letterSpacing: Platform.OS === 'android' ? 1.1 : 0,
    },
    disabled: {
      opacity: 0.5,
    },
    disabledText: {
      color: colors.textLight,
    },

    // Variants
    primaryContainer: {
      backgroundColor: colors.primary,
    },
    primaryText: {
      color: '#FFFFFF',
    },
    secondaryContainer: {
      backgroundColor: colors.inputBackground,
    },
    secondaryText: {
      color: colors.text,
    },
    outlineContainer: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    outlineText: {
      color: colors.text,
    },
    dangerContainer: {
      backgroundColor: colors.danger,
    },
    dangerText: {
      color: '#FFFFFF',
    },
    successContainer: {
      backgroundColor: colors.success,
    },
    successText: {
      color: '#FFFFFF',
    },
    ghostContainer: {
      backgroundColor: 'transparent',
    },
    ghostText: {
      color: colors.primary,
    },

    // Sizes
    smallContainer: {
      paddingVertical: Platform.OS === 'android' ? spacing.xs : spacing.sm,
      paddingHorizontal: spacing.md,
    },
    smallText: {
      fontSize: Platform.OS === 'android' ? 12 : 14,
    },
    mediumContainer: {
      paddingVertical: Platform.OS === 'android' ? spacing.sm : spacing.md,
      paddingHorizontal: Platform.OS === 'android' ? spacing.md : spacing.lg,
    },
    mediumText: {
      fontSize: Platform.OS === 'android' ? 13 : 16,
    },
    largeContainer: {
      paddingVertical: Platform.OS === 'android' ? spacing.md : spacing.lg,
      paddingHorizontal: Platform.OS === 'android' ? spacing.lg : spacing.xl,
    },
    largeText: {
      fontSize: Platform.OS === 'android' ? 15 : 18,
    },

    // Icons
    iconLeft: {
      marginRight: Platform.OS === 'android' ? spacing.xs : spacing.sm,
    },
    iconRight: {
      marginLeft: Platform.OS === 'android' ? spacing.xs : spacing.sm,
    },
  });

export default Button;
