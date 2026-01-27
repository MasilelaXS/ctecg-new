import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Typography, Spacing } from '../constants/Design';
import { apiService } from '../services/api';
import { showToast } from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errors, setErrors] = useState({
    code: '',
    newPassword: '',
    confirmPassword: '',
  });

  const validatePassword = (password: string): string => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    return '';
  };

  const handleCodeChange = (text: string) => {
    // Only allow numbers, max 6 digits
    const cleaned = text.replace(/[^0-9]/g, '');
    setCode(cleaned.slice(0, 6));
    setErrors({ ...errors, code: '' });
  };

  const handlePasswordChange = (text: string) => {
    setNewPassword(text);
    setErrors({ ...errors, newPassword: '' });
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    setErrors({ ...errors, confirmPassword: '' });
  };

  const handleSubmit = async () => {
    // Validate code
    if (code.length !== 6) {
      setErrors({ ...errors, code: 'Please enter the 6-digit code' });
      return;
    }

    // Validate new password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setErrors({ ...errors, newPassword: passwordError });
      return;
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setErrors({ ...errors, confirmPassword: 'Passwords do not match' });
      return;
    }

    setLoading(true);

    try {
      const response = await apiService.resetPassword(code, newPassword);

      if (response.success) {
        setShowSuccessModal(true);
      } else {
        showToast.error('Error', response.message || 'Failed to reset password. Please try again.');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      showToast.error(
        'Error',
        error instanceof Error ? error.message : 'Failed to reset password. The code may be invalid or expired.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (): string => {
    if (newPassword.length === 0) return '';
    if (newPassword.length < 8) return 'Weak';
    
    let strength = 0;
    if (/(?=.*[a-z])/.test(newPassword)) strength++;
    if (/(?=.*[A-Z])/.test(newPassword)) strength++;
    if (/(?=.*\d)/.test(newPassword)) strength++;
    if (/(?=.*[@$!%*?&])/.test(newPassword)) strength++;
    if (newPassword.length >= 12) strength++;

    if (strength <= 2) return 'Weak';
    if (strength <= 3) return 'Medium';
    return 'Strong';
  };

  const getPasswordStrengthColor = (): string => {
    const strength = getPasswordStrength();
    if (strength === 'Weak') return '#FF4444';
    if (strength === 'Medium') return '#FF8800';
    return '#00CC44';
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reset Password</Text>
          <View style={styles.backButton} />
        </View>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="lock-closed" size={48} color={Colors.primary} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Enter Reset Code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to your email. Enter it below along with your new password.
        </Text>

        {/* Code Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Reset Code</Text>
          <View style={[styles.inputWrapper, errors.code ? styles.inputError : null]}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={errors.code ? Colors.error : Colors.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={handleCodeChange}
              placeholder="000000"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus={true}
              editable={!loading}
            />
          </View>
          {errors.code ? <Text style={styles.errorText}>{errors.code}</Text> : null}
          {!errors.code && code.length > 0 && code.length < 6 ? (
            <Text style={styles.hintText}>{6 - code.length} digits remaining</Text>
          ) : null}
        </View>

        {/* New Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>New Password</Text>
          <View style={[styles.inputWrapper, errors.newPassword ? styles.inputError : null]}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={errors.newPassword ? Colors.error : Colors.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={handlePasswordChange}
              placeholder="Enter new password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          {errors.newPassword ? (
            <Text style={styles.errorText}>{errors.newPassword}</Text>
          ) : null}
          {!errors.newPassword && newPassword.length > 0 ? (
            <View style={styles.strengthContainer}>
              <Text style={styles.strengthLabel}>Strength: </Text>
              <Text style={[styles.strengthValue, { color: getPasswordStrengthColor() }]}>
                {getPasswordStrength()}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Confirm Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={[styles.inputWrapper, errors.confirmPassword ? styles.inputError : null]}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={errors.confirmPassword ? Colors.error : Colors.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              placeholder="Re-enter new password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword ? (
            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
          ) : null}
        </View>

        {/* Password Requirements */}
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Password must contain:</Text>
          <View style={styles.requirementRow}>
            <Ionicons
              name={newPassword.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={newPassword.length >= 8 ? '#00CC44' : Colors.textMuted}
            />
            <Text style={styles.requirementText}>At least 8 characters</Text>
          </View>
          <View style={styles.requirementRow}>
            <Ionicons
              name={/(?=.*[a-z])/.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={/(?=.*[a-z])/.test(newPassword) ? '#00CC44' : Colors.textMuted}
            />
            <Text style={styles.requirementText}>One lowercase letter</Text>
          </View>
          <View style={styles.requirementRow}>
            <Ionicons
              name={/(?=.*[A-Z])/.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={/(?=.*[A-Z])/.test(newPassword) ? '#00CC44' : Colors.textMuted}
            />
            <Text style={styles.requirementText}>One uppercase letter</Text>
          </View>
          <View style={styles.requirementRow}>
            <Ionicons
              name={/(?=.*\d)/.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={/(?=.*\d)/.test(newPassword) ? '#00CC44' : Colors.textMuted}
            />
            <Text style={styles.requirementText}>One number</Text>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <Text style={styles.submitButtonText}>Reset Password</Text>
          )}
        </TouchableOpacity>

        {/* Back to Login */}
        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
          disabled={loading}
        >
          <Text style={styles.loginLinkText}>Back to Login</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Success Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        type="success"
        title="Password Reset!"
        message="Your password has been reset successfully. Please login with your new password."
        confirmText="Login"
        onConfirm={() => {
          setShowSuccessModal(false);
          navigation.navigate('Login');
        }}
        onCancel={() => setShowSuccessModal(false)}
        showCancel={false}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: Typography.md * Typography.lineHeights.relaxed,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Typography.md,
    color: Colors.text,
    padding: 0,
  },
  eyeIcon: {
    padding: Spacing.xs,
  },
  errorText: {
    fontSize: Typography.xs,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  hintText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  strengthLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  strengthValue: {
    fontSize: Typography.xs,
    fontWeight: Typography.weights.semibold,
  },
  requirementsContainer: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  requirementsTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  requirementText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.textInverse,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wide,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  loginLinkText: {
    fontSize: Typography.md,
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
});
