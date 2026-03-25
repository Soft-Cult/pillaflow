import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';

const Card = ({
  children,
  style,
  onPress,
  disabled = false,
  variant = 'default',
}) => {
  const { themeColors } = useApp();
  const styles = React.useMemo(() => createStyles(), [themeColors]);
  const cardStyle = [
    styles.card,
    variant === 'elevated' && styles.elevated,
    { backgroundColor: themeColors.card, borderColor: themeColors.border },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: Platform.OS === 'android' ? 3 : borderRadius.lg,
      padding: Platform.OS === 'android' ? spacing.md : spacing.lg,
      ...(Platform.OS === 'android' ? shadows.small : shadows.medium),
      borderWidth: Platform.OS === 'android' ? 2 : 1,
      borderColor: Platform.OS === 'android' ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.04)',
    },
    elevated: {
      ...shadows.large,
    },
  });

export default Card;
