import React, { useState } from 'react';
import {
  View,
  Text,
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
import { OtpCodeField, PasswordField } from '../components/AuthFields';
import { PASSWORD_MIN_LENGTH, validatePassword as validatePasswordPolicy } from '../utils/helpers-new';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errors, setErrors] = useState({
    code: '',
    newPassword: '',
    confirmPassword: '',
  });

  const validatePassword = (password: string): string => {
    return validatePasswordPolicy(password).errors[0] || '';
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
      const response = await apiService.resetPassword(code, newPassword, route.params.identifier);

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
    if (newPassword.length < PASSWORD_MIN_LENGTH) return 'Weak';
    
    let strength = 0;
    if (/(?=.*[a-z])/.test(newPassword)) strength++;
    if (/(?=.*[A-Z])/.test(newPassword)) strength++;
    if (/(?=.*\d)/.test(newPassword)) strength++;
    if (/(?=.*[@$!%*?&])/.test(newPassword)) strength++;
    if (newPassword.length >= PASSWORD_MIN_LENGTH) strength++;

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

        <OtpCodeField
          label="Verification Code"
          value={code}
          onChangeText={handleCodeChange}
          error={errors.code}
          helperText={code.length > 0 && code.length < 6 ? `${6 - code.length} digits remaining` : undefined}
          autoFocus
          disabled={loading}
        />

        <PasswordField
          label="New Password"
          value={newPassword}
          onChangeText={handlePasswordChange}
          placeholder="Enter new password"
          error={errors.newPassword}
          disabled={loading}
          autoComplete="new-password"
          textContentType="newPassword"
          helperContent={!errors.newPassword && newPassword.length > 0 ? (
            <View style={styles.strengthContainer}>
              <Text style={styles.strengthLabel}>Strength: </Text>
              <Text style={[styles.strengthValue, { color: getPasswordStrengthColor() }]}>
                {getPasswordStrength()}
              </Text>
            </View>
          ) : undefined}
        />

        <PasswordField
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          placeholder="Re-enter new password"
          error={errors.confirmPassword}
          disabled={loading}
          autoComplete="new-password"
          textContentType="newPassword"
        />

        {/* Password Requirements */}
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Password must contain:</Text>
          <View style={styles.requirementRow}>
            <Ionicons
              name={newPassword.length >= PASSWORD_MIN_LENGTH ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={newPassword.length >= PASSWORD_MIN_LENGTH ? '#00CC44' : Colors.textMuted}
            />
            <Text style={styles.requirementText}>At least {PASSWORD_MIN_LENGTH} characters</Text>
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
