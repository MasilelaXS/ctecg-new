import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Typography, Spacing } from '../constants/Design';
import { showToast } from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { OtpCodeField, PasswordField } from '../components/AuthFields';
import { PASSWORD_MIN_LENGTH, validatePassword as validatePasswordPolicy } from '../utils/helpers-new';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePassword'>;

// Mask email for display (e.g., "test@example.com" -> "t***@e*****.com")
const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email;
  
  const [localPart, domain] = email.split('@');
  const [domainName, ...domainExt] = domain.split('.');
  
  const maskedLocal = localPart.length > 2
    ? localPart[0] + '*'.repeat(Math.min(localPart.length - 1, 4))
    : localPart[0] + '*';
  
  const maskedDomain = domainName.length > 2
    ? domainName[0] + '*'.repeat(Math.min(domainName.length - 1, 5))
    : domainName[0] + '*';
  
  return `${maskedLocal}@${maskedDomain}.${domainExt.join('.')}`;
};

export default function CreatePasswordScreen({ navigation, route }: Props) {
  const { userId, email } = route.params;
  const [resetCode, setResetCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errors, setErrors] = useState({
    resetCode: '',
    password: '',
    confirmPassword: '',
  });

  const validatePassword = (pass: string): string => {
    return validatePasswordPolicy(pass).errors[0] || '';
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setErrors({ ...errors, password: '' });
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    setErrors({ ...errors, confirmPassword: '' });
  };

  const handleSubmit = async () => {
    if (!/^\d{6}$/.test(resetCode)) {
      setErrors({ ...errors, resetCode: 'Enter the 6-digit code sent to your email' });
      return;
    }
    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setErrors({ ...errors, password: passwordError });
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setErrors({ ...errors, confirmPassword: 'Passwords do not match' });
      return;
    }

    setLoading(true);

    try {
      const response = await apiService.createPassword(userId, email, resetCode, password);

      if (response.success) {
        setShowSuccessModal(true);
      } else {
        showToast.error('Error', response.message || 'Failed to create password. Please try again.');
      }
    } catch (error) {
      console.error('Create password error:', error);
      showToast.error(
        'Error',
        error instanceof Error ? error.message : 'Failed to create password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (): string => {
    if (password.length === 0) return '';
    if (password.length < PASSWORD_MIN_LENGTH) return 'Weak';
    
    let strength = 0;
    if (/(?=.*[a-z])/.test(password)) strength++;
    if (/(?=.*[A-Z])/.test(password)) strength++;
    if (/(?=.*\d)/.test(password)) strength++;
    if (/(?=.*[@$!%*?&])/.test(password)) strength++;
    if (password.length >= PASSWORD_MIN_LENGTH) strength++;

    if (strength <= 2) return 'Weak';
    if (strength <= 3) return 'Medium';
    return 'Strong';
  };

  const getPasswordStrengthColor = (): string => {
    const strength = getPasswordStrength();
    if (strength === 'Weak') return Colors.error;
    if (strength === 'Medium') return Colors.warning;
    return Colors.success;
  };

  const isFormValid = /^\d{6}$/.test(resetCode) && validatePasswordPolicy(password).isValid && confirmPassword.length > 0 && password === confirmPassword;

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
          <Text style={styles.headerTitle}>Create Password</Text>
          <View style={styles.backButton} />
        </View>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="key" size={48} color={Colors.primary} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Create Your Password</Text>
        <Text style={styles.subtitle}>
          Enter the verification code sent to{' '}
          <Text style={styles.emailHighlight}>{maskEmail(email)}</Text>
          {' '}and create your password.
        </Text>

        <OtpCodeField
          label="Verification Code"
          value={resetCode}
          onChangeText={(text) => {
            setResetCode(text);
            setErrors({ ...errors, resetCode: '' });
          }}
          error={errors.resetCode}
          disabled={loading}
        />

        <PasswordField
          label="New Password"
          value={password}
          onChangeText={handlePasswordChange}
          placeholder="Enter new password"
          error={errors.password}
          disabled={loading}
          autoComplete="new-password"
          textContentType="newPassword"
          helperContent={!errors.password && password.length > 0 ? (
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
          placeholder="Confirm your password"
          error={errors.confirmPassword}
          disabled={loading}
          autoComplete="new-password"
          textContentType="newPassword"
          helperContent={!errors.confirmPassword && confirmPassword.length > 0 && password === confirmPassword ? (
            <View style={styles.matchContainer}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={styles.matchText}>Passwords match</Text>
            </View>
          ) : undefined}
        />

        {/* Password Requirements */}
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Password must contain:</Text>
          <View style={styles.requirementRow}>
            <Ionicons
              name={password.length >= PASSWORD_MIN_LENGTH ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={password.length >= PASSWORD_MIN_LENGTH ? Colors.success : Colors.textMuted}
            />
            <Text style={[
              styles.requirementText,
              password.length >= PASSWORD_MIN_LENGTH && styles.requirementMet
            ]}>
              At least {PASSWORD_MIN_LENGTH} characters
            </Text>
          </View>
          <View style={styles.requirementRow}>
            <Ionicons
              name={/[A-Z]/.test(password) ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={/[A-Z]/.test(password) ? Colors.success : Colors.textMuted}
            />
            <Text style={[
              styles.requirementText,
              /[A-Z]/.test(password) && styles.requirementMet
            ]}>
              One uppercase letter
            </Text>
          </View>
          <View style={styles.requirementRow}>
            <Ionicons
              name={/[a-z]/.test(password) ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={/[a-z]/.test(password) ? Colors.success : Colors.textMuted}
            />
            <Text style={[
              styles.requirementText,
              /[a-z]/.test(password) && styles.requirementMet
            ]}>
              One lowercase letter
            </Text>
          </View>
          <View style={styles.requirementRow}>
            <Ionicons
              name={/\d/.test(password) ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={/\d/.test(password) ? Colors.success : Colors.textMuted}
            />
            <Text style={[
              styles.requirementText,
              /\d/.test(password) && styles.requirementMet
            ]}>
              One number
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!isFormValid || loading) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!isFormValid || loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <Text style={styles.submitButtonText}>Create Password</Text>
          )}
        </TouchableOpacity>

        {/* Back to Login Link */}
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
        title="Password Created!"
        message="Your password has been created successfully. Please login with your new password."
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
  emailHighlight: {
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
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
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: 4,
  },
  matchText: {
    fontSize: Typography.xs,
    color: Colors.success,
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
  requirementMet: {
    color: Colors.success,
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
