import React, { ReactNode, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Colors, Spacing, Typography } from '../constants/Design';

type SharedFieldProps = {
  label: string;
  error?: string;
  helperText?: string;
  helperContent?: ReactNode;
  disabled?: boolean;
  labelAction?: ReactNode;
};

type OtpCodeFieldProps = SharedFieldProps & {
  value: string;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
};

export function OtpCodeField({
  label,
  value,
  onChangeText,
  error,
  helperText,
  helperContent,
  disabled = false,
  autoFocus = false,
  placeholder = '000000',
}: OtpCodeFieldProps) {
  const handleChange = (text: string) => {
    onChangeText(text.replace(/\D/g, '').slice(0, 6));
  };

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, styles.otpWrapper, error ? styles.inputError : null]}>
        <TextInput
          accessibilityLabel={label}
          style={styles.otpInput}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus={autoFocus}
          editable={!disabled}
          selectTextOnFocus
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helperContent ? helperContent : null}
      {!error && !helperContent && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

type PasswordFieldProps = SharedFieldProps & {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
};

export function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  helperContent,
  disabled = false,
  labelAction,
  autoComplete = 'password',
  textContentType = 'password',
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.fieldContainer}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelAction}
      </View>
      <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
        <Ionicons
          name="lock-closed-outline"
          size={20}
          color={error ? Colors.error : Colors.textSecondary}
          style={styles.inputIcon}
        />
        <TextInput
          accessibilityLabel={label}
          style={styles.passwordInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={!isVisible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContentType}
          editable={!disabled}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onPress={() => setIsVisible((visible) => !visible)}
          style={styles.visibilityButton}
          disabled={disabled}
        >
          <Ionicons
            name={isVisible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helperContent ? helperContent : null}
      {!error && !helperContent && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
    letterSpacing: Typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.sm,
    fontSize: Typography.md,
    fontWeight: Typography.weights.regular,
    color: Colors.text,
  },
  visibilityButton: {
    minWidth: 40,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpWrapper: {
    minHeight: 60,
  },
  otpInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontSize: Typography.xxl,
    fontWeight: Typography.weights.bold,
    letterSpacing: 8,
    textAlign: 'center',
    color: Colors.text,
  },
  errorText: {
    marginTop: Spacing.xs,
    fontSize: Typography.xs,
    color: Colors.error,
  },
  helperText: {
    marginTop: Spacing.xs,
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
});
