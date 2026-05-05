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
import { showToast } from '../components/Toast';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Typography, Spacing } from '../constants/Design';
import { apiService } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotEmail'>;

export default function ForgotEmailScreen({ navigation }: Props) {
  const [clientCode, setClientCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [showResult, setShowResult] = useState(false);

  const handleSubmit = async () => {
    if (!clientCode.trim()) {
      showToast.error('Error', 'Please enter your client code');
      return;
    }

    setLoading(true);

    try {
      const response = await apiService.forgotEmail(clientCode.trim().toUpperCase());

      if (response.success && response.data) {
        setMaskedEmail(response.data.email || '');
        setShowResult(true);
      } else {
        showToast.error('Error', response.message || 'No account found with this client code.');
      }
    } catch (error) {
      console.error('Forgot email error:', error);
      showToast.error('Not Found', 'No account found with this client code. Please verify your client code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const [showSupportModal, setShowSupportModal] = useState(false);

  const handleContactSupport = () => {
    setShowSupportModal(true);
  };

  const handleBackToLogin = () => {
    navigation.navigate('Login');
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
          <Text style={styles.headerTitle}>Forgot Email</Text>
          <View style={styles.backButton} />
        </View>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="mail-outline" size={48} color={Colors.primary} />
          </View>
        </View>

        {!showResult ? (
          <>
            {/* Title */}
            <Text style={styles.title}>Recover Your Email</Text>
            <Text style={styles.subtitle}>
              Enter your client code (invoicing ID) to view your registered email address.
            </Text>

            {/* Client Code Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Client Code</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="card-outline"
                  size={20}
                  color={Colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={clientCode}
                  onChangeText={(text) => setClientCode(text.toUpperCase())}
                  placeholder="e.g., MAS075"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                  autoFocus={true}
                  editable={!loading}
                />
              </View>
              <Text style={styles.hintText}>
                Your client code can be found on your invoices
              </Text>
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
                <Text style={styles.submitButtonText}>Find My Email</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Success Result */}
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
              </View>
              <Text style={styles.successTitle}>Email Found!</Text>
              
              <View style={styles.emailBox}>
                <Ionicons name="mail" size={24} color={Colors.primary} style={styles.emailIcon} />
                <Text style={styles.emailText}>{maskedEmail}</Text>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={Colors.warning} />
                <Text style={styles.infoText}>
                  If you don't recognize this email address or need further assistance, please contact our support team.
                </Text>
              </View>

              {/* Actions */}
              <TouchableOpacity
                style={styles.supportButton}
                onPress={handleContactSupport}
              >
                <Ionicons name="headset-outline" size={20} color={Colors.textInverse} />
                <Text style={styles.supportButtonText}>Contact Support</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleBackToLogin}
              >
                <Text style={styles.loginButtonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Back to Login (when not showing result) */}
        {!showResult && (
          <TouchableOpacity
            style={styles.loginLink}
            onPress={handleBackToLogin}
            disabled={loading}
          >
            <Text style={styles.loginLinkText}>Back to Login</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Support Contact Modal */}
      <ConfirmationModal
        visible={showSupportModal}
        type="info"
        title="Contact Support"
        message="Please contact CTECG support for assistance:\n\nEmail: helpdesk@ctecg.co.za\nCustomer Care: 076 979 0642\nLandline: 013 262 4798"
        confirmText="OK"
        onConfirm={() => setShowSupportModal(false)}
        onCancel={() => setShowSupportModal(false)}
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
    marginBottom: Spacing.xl,
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
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Typography.md,
    color: Colors.text,
    padding: 0,
  },
  hintText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
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
  successContainer: {
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: Typography.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  emailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    width: '100%',
  },
  emailIcon: {
    marginRight: Spacing.md,
  },
  emailText: {
    flex: 1,
    fontSize: Typography.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.text,
    marginLeft: Spacing.sm,
    lineHeight: Typography.sm * Typography.lineHeights.relaxed,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    width: '100%',
    marginBottom: Spacing.md,
  },
  supportButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.textInverse,
    marginLeft: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wide,
  },
  loginButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    width: '100%',
  },
  loginButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wide,
  },
});
