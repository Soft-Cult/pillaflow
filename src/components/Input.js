import React, { useMemo, useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  multiline = false,
  numberOfLines = 1,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  disableFullscreenUI = true,
  icon,
  rightIcon,
  onRightIconPress,
  error,
  disabled = false,
  style,
  inputStyle,
  containerStyle,
  disableTranslation = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { t, themeColors } = useApp();
  const palette = themeColors || colors;
  const styles = useMemo(() => createStyles(palette), [palette]);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {typeof label === 'string' && !disableTranslation ? t(label) : label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
          disabled && styles.inputContainerDisabled,
          multiline && styles.inputContainerMultiline,
          style,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={isFocused ? palette.primary : palette.textLight}
            style={styles.leftIcon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={
            typeof placeholder === 'string' && !disableTranslation
              ? t(placeholder)
              : placeholder
          }
          placeholderTextColor={palette.placeholder}
          secureTextEntry={secureTextEntry && !showPassword}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          disableFullscreenUI={disableFullscreenUI}
          editable={!disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIcon}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={palette.textLight}
            />
          </TouchableOpacity>
        )}
        {rightIcon && !secureTextEntry && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIcon}
            disabled={!onRightIconPress}
          >
            <Ionicons
              name={rightIcon}
              size={20}
              color={palette.textLight}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const createStyles = (palette) =>
  StyleSheet.create({
    container: {
      marginBottom: Platform.OS === 'android' ? spacing.md : spacing.lg,
    },
    label: {
      ...typography.label,
      marginBottom: Platform.OS === 'android' ? 2 : spacing.sm,
      fontSize: Platform.OS === 'android' ? 11 : typography.label.fontSize,
      textTransform: Platform.OS === 'android' ? 'uppercase' : 'none',
      letterSpacing: Platform.OS === 'android' ? 1.1 : 0,
      color: palette.text,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.inputBackground,
      borderRadius: Platform.OS === 'android' ? 0 : borderRadius.md,
      borderWidth: Platform.OS === 'android' ? 2 : 1,
      borderColor: palette.border,
      paddingHorizontal: Platform.OS === 'android' ? spacing.sm : spacing.md,
      minHeight: Platform.OS === 'android' ? 38 : undefined,
    },
    inputContainerFocused: {
      borderColor: Platform.OS === 'android' ? palette.textLight : palette.primary,
      backgroundColor: palette.inputBackground,
    },
    inputContainerError: {
      borderColor: palette.danger,
    },
    inputContainerDisabled: {
      backgroundColor: palette.divider,
      opacity: 0.7,
    },
    inputContainerMultiline: {
      alignItems: 'flex-start',
      paddingVertical: Platform.OS === 'android' ? spacing.xs : spacing.sm,
    },
    input: {
      flex: 1,
      fontSize: Platform.OS === 'android' ? 15 : 16,
      color: palette.text,
      paddingVertical: Platform.OS === 'android' ? spacing.sm : spacing.md,
    },
    inputMultiline: {
      minHeight: Platform.OS === 'android' ? 72 : 100,
      paddingTop: spacing.sm,
    },
    leftIcon: {
      marginRight: Platform.OS === 'android' ? spacing.xs : spacing.sm,
    },
    rightIcon: {
      marginLeft: Platform.OS === 'android' ? spacing.xs : spacing.sm,
      padding: Platform.OS === 'android' ? 1 : spacing.xs,
    },
    errorText: {
      color: palette.danger || colors.danger,
      fontSize: 12,
      marginTop: spacing.xs,
    },
  });

export default Input;
