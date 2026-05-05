import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import { validateSAPhoneNumber, formatPhoneInput, normalizePhoneNumber } from '../utils/phoneValidation';

import CustomButton from '../components/CustomButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { showToast } from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { Colors, Typography, Spacing, BorderRadius, CommonStyles } from '../constants/Design';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

interface CheckUserData {
  client_code: string;
  customer_name: string;
  email_options?: string[];
  phone_options?: string[];
  accounts: {
    account_number: string;
    customer_name: string;
    status: string;
    email: string;
  }[];
  user_exists?: boolean;
  user_email?: string;
  message: string;
}

export default function LoginScreen({ navigation }: Props) {
  const [clientCode, setClientCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loginWithEmail, setLoginWithEmail] = useState(true);
  const [userData, setUserData] = useState<CheckUserData | null>(null);
  const [emailOptions, setEmailOptions] = useState<string[]>([]);
  const [phoneOptions, setPhoneOptions] = useState<string[]>([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [mismatchAttempts, setMismatchAttempts] = useState(0);
  const [showMismatchModal, setShowMismatchModal] = useState(false);
  const [mismatchType, setMismatchType] = useState<'email' | 'phone' | 'both'>('email');
  const { login } = useAuth();

  // Modal states
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetSentModal, setShowResetSentModal] = useState(false);

  const handlePhoneChange = (text: string) => {
    // Format as user types
    const formatted = formatPhoneInput(text);
    setPhone(formatted);
    
    // Clear error when user starts typing
    if (phoneError) {
      setPhoneError('');
    }
  };

  const validatePhone = (): boolean => {
    const validation = validateSAPhoneNumber(phone);
    if (!validation.isValid) {
      setPhoneError(validation.error || 'Invalid phone number');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleLogin = async () => {
    let identifier = loginWithEmail ? email.trim() : phone.trim();
    
    if (!identifier) {
      showToast.error('Error', loginWithEmail ? 'Please enter your email address' : 'Please enter your phone number');
      return;
    }

    // Validate and normalize phone number
    if (!loginWithEmail) {
      if (!validatePhone()) {
        return;
      }
      identifier = normalizePhoneNumber(phone);
    }

    if (!password.trim()) {
      showToast.error('Error', 'Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      await login(identifier, password);
    } catch (error: any) {
      // Check if user needs to create a password
      if (error.requiresPasswordCreation) {
        navigation.navigate('CreatePassword', {
          userId: error.userId,
          email: error.email,
        });
      } 
      // Check if account needs verification
      else if (error.requiresVerification) {
        navigation.navigate('VerifyOTP', {
          email: error.email,
          password: password,
        });
      } 
      else {
        showToast.error('Login Failed', error.message || 'Please check your credentials and try again');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    let identifier = loginWithEmail ? email.trim() : phone.trim();
    
    if (!identifier) {
      showToast.info(
        'Reset Password',
        `Please enter your ${loginWithEmail ? 'email address' : 'phone number'} first`
      );
      return;
    }

    // Validate and normalize phone number
    if (!loginWithEmail) {
      const validation = validateSAPhoneNumber(phone);
      if (!validation.isValid) {
        setPhoneError(validation.error || 'Invalid phone number');
        return;
      }
      identifier = normalizePhoneNumber(phone);
    }

    setShowResetConfirm(true);
  };

  const sendResetCode = async () => {
    setShowResetConfirm(false);
    let identifier = loginWithEmail ? email.trim() : normalizePhoneNumber(phone);
    
    setIsLoading(true);
    try {
      const response = await apiService.forgotPassword(identifier);
      if (response.success) {
        setShowResetSentModal(true);
      } else {
        showToast.error('Error', response.message || 'Failed to send reset code');
      }
    } catch (error: any) {
      showToast.error('Error', error.message || 'Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWhatsAppSupport = async () => {
    try {
      await Linking.openURL('https://wa.me/27769790642');
    } catch (error) {
      console.error('WhatsApp link error:', error);
      showToast.error('Error', 'Unable to open WhatsApp');
    }
  };

  const handleCheckUser = async () => {
    if (!clientCode.trim()) {
      showToast.error('Error', 'Please enter your client code');
      return;
    }

    console.log('🔍 Checking client code:', clientCode.trim());
    setIsLoading(true);
    
    try {
      const response = await apiService.checkUser(clientCode.trim());
      console.log('✅ CheckUser response:', response);
      
      if (response.success && response.data) {
        setUserData(response.data);

        const fetchedEmailOptions = response.data.email_options ?? [];
        const fetchedPhoneOptions = response.data.phone_options ?? [];
        setEmailOptions(fetchedEmailOptions);
        setPhoneOptions(fetchedPhoneOptions);
        // Don't auto-fill for security
        setEmailInput('');
        setPhoneInput('');
        setMismatchAttempts(0);
        
        // Pre-fill email from first account if available
        if (response.data.accounts && response.data.accounts.length > 0) {
          setEmail(response.data.accounts[0].email || '');
        }
        
        // User doesn't exist, proceed with registration
        if (!response.data.user_exists) {
          // Form is already showing registration fields
        } else {
          showToast.info('Account Exists', 'This client code is already registered. Please use the login form.');
        }
      }
    } catch (error: any) {
      showToast.error('Customer Not Found', error.message || 'Please check your client code and try again');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!password.trim()) {
      showToast.error('Error', 'Please create a password');
      return;
    }

    if (password.length < 8) {
      showToast.error('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (!emailInput.trim()) {
      showToast.error('Error', 'Please enter your email address');
      return;
    }

    if (!phoneInput.trim()) {
      showToast.error('Error', 'Please enter your phone number');
      return;
    }

    // Validate against Azotel options
    const emailMatches = emailOptions.some(opt => opt.toLowerCase() === emailInput.toLowerCase().trim());
    const phoneMatches = phoneOptions.some(opt => {
      const normalizedInput = phoneInput.trim().replace(/\s/g, '');
      const normalizedOpt = opt.replace(/\s/g, '');
      return normalizedOpt === normalizedInput || normalizedOpt === '+27' + normalizedInput.replace(/^0/, '');
    });

    if (!emailMatches || !phoneMatches) {
      // Show mismatch modal for confirmation
      if (!emailMatches && !phoneMatches) {
        setMismatchType('both');
      } else if (!emailMatches) {
        setMismatchType('email');
      } else {
        setMismatchType('phone');
      }
      setShowMismatchModal(true);
      return;
    }

    // Match found, use the matched values
    const matchedEmail = emailOptions.find(opt => opt.toLowerCase() === emailInput.toLowerCase().trim())!;
    const matchedPhone = phoneOptions.find(opt => {
      const normalizedInput = phoneInput.trim().replace(/\s/g, '');
      const normalizedOpt = opt.replace(/\s/g, '');
      return normalizedOpt === normalizedInput || normalizedOpt === '+27' + normalizedInput.replace(/^0/, '');
    })!

    setIsLoading(true);
    try {
      const response = await apiService.register({
        invoicingid: clientCode.trim(),
        selected_email: matchedEmail,
        selected_phone: matchedPhone,
        password: password,
      });

      if (response.success && response.data) {
        // Navigate to OTP verification screen
        navigation.navigate('VerifyOTP', { 
          email: matchedEmail, 
          password: password 
        });
      }
    } catch (error: any) {
      showToast.error('Registration Failed', error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMismatchConfirm = () => {
    setShowMismatchModal(false);
    setMismatchAttempts(prev => prev + 1);
  };

  const handleMismatchRetry = () => {
    setShowMismatchModal(false);
  };

  const handleRegisterWithMismatch = async () => {
    setShowMismatchModal(false);
    
    // Use user-provided values even if they don't match
    setIsLoading(true);
    try {
      const response = await apiService.register({
        invoicingid: clientCode.trim(),
        selected_email: emailInput.trim(),
        selected_phone: phoneInput.trim(),
        password: password,
      });

      if (response.success && response.data) {
        navigation.navigate('VerifyOTP', { 
          email: emailInput.trim(), 
          password: password 
        });
      }
    } catch (error: any) {
      showToast.error('Registration Failed', error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setClientCode('');
    setEmail('');
    setPhone('');
    setPassword('');
    setUserData(null);
    setEmailOptions([]);
    setPhoneOptions([]);
    setSelectedEmail('');
    setSelectedPhone('');
    setEmailInput('');
    setPhoneInput('');
    setMismatchAttempts(0);
  };

  const toggleLoginMethod = () => {
    setLoginWithEmail(!loginWithEmail);
    setEmail('');
    setPhone('');
  };

  const missingEmail = emailOptions.length === 0;
  const missingPhone = phoneOptions.length === 0;
  const needsSupport = !!userData && !userData.user_exists && (missingEmail || missingPhone || mismatchAttempts >= 2);
  const supportMessage = mismatchAttempts >= 2
    ? 'The information you entered does not match our records. Please contact support for assistance.'
    : missingEmail && missingPhone
      ? 'No email address or phone number found for this account. Please contact support.'
      : missingEmail
        ? 'No email address found for this account. Please contact support.'
        : 'No phone number found for this account. Please contact support.';
  const canRegister = !!userData && !userData.user_exists && !missingEmail && !missingPhone;

  if (isLoading) {
    return <LoadingSpinner message="Please wait..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/logo-clean.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.tagline}>Your Connection, Your Control</Text>
            </View>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            {!isRegisterMode ? (
              <>
                {/* LOGIN MODE */}
                <Text style={styles.welcomeText}>Welcome back!</Text>
                <Text style={styles.subtitleText}>
                  Sign in to access your account
                </Text>

                {/* Login Method Toggle */}
                <View style={styles.loginMethodToggle}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      loginWithEmail && styles.toggleButtonActive
                    ]}
                    onPress={() => setLoginWithEmail(true)}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={loginWithEmail ? Colors.textInverse : Colors.textSecondary}
                      style={styles.toggleIcon}
                    />
                    <Text style={[
                      styles.toggleButtonText,
                      loginWithEmail && styles.toggleButtonTextActive
                    ]}>
                      Email
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      !loginWithEmail && styles.toggleButtonActive
                    ]}
                    onPress={() => setLoginWithEmail(false)}
                  >
                    <Ionicons
                      name="call-outline"
                      size={18}
                      color={!loginWithEmail ? Colors.textInverse : Colors.textSecondary}
                      style={styles.toggleIcon}
                    />
                    <Text style={[
                      styles.toggleButtonText,
                      !loginWithEmail && styles.toggleButtonTextActive
                    ]}>
                      Phone
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Email or Phone Input based on toggle */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    {loginWithEmail ? 'Email Address' : 'Phone Number'}
                  </Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name={loginWithEmail ? "mail-outline" : "call-outline"}
                      size={20}
                      color={Colors.textSecondary}
                      style={styles.inputIcon}
                    />
                    {loginWithEmail ? (
                      <TextInput
                        style={styles.textInput}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Enter your email address"
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                      />
                    ) : (
                      <TextInput
                        style={styles.textInput}
                        value={phone}
                        onChangeText={handlePhoneChange}
                        placeholder="e.g., 0769790642"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="phone-pad"
                        autoCorrect={false}
                        maxLength={12}
                      />
                    )}
                  </View>
                  {!loginWithEmail && phoneError && (
                    <Text style={styles.errorText}>{phoneError}</Text>
                  )}
                  {!loginWithEmail && !phoneError && phone.length > 0 && (
                    <Text style={styles.hintText}>Format: 0XX XXX XXXX (10 digits)</Text>
                  )}
                </View>

                {/* Password Input */}
                <View style={styles.inputContainer}>
                  <View style={styles.passwordLabelRow}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <TouchableOpacity onPress={handleForgotPassword}>
                      <Text style={styles.forgotPasswordLink}>Forgot?</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={Colors.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.textInput, styles.passwordInput]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.passwordToggle}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={Colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Login Button */}
                <View style={styles.buttonContainer}>
                  <CustomButton
                    title="Sign In"
                    onPress={handleLogin}
                    variant="primary"
                    size="large"
                    style={styles.primaryButton}
                  />
                </View>

                {/* Switch to Register */}
                <View style={styles.switchModeContainer}>
                  <Text style={styles.switchModeText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={toggleMode}>
                    <Text style={styles.switchModeLink}>Create Account</Text>
                  </TouchableOpacity>
                </View>

                {/* Forgot Email Link */}
                <View style={styles.forgotEmailContainer}>
                  <TouchableOpacity onPress={() => navigation.navigate('ForgotEmail')}>
                    <Text style={styles.forgotEmailLink}>
                      <Ionicons name="help-circle-outline" size={16} color={Colors.textSecondary} />
                      {' '}Forgot your email address?
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* REGISTER MODE */}
                <Text style={styles.welcomeText}>Create Account</Text>
                <Text style={styles.subtitleText}>
                  Enter your client code to get started
                </Text>

                {/* Customer Info Display */}
                {userData && (
                  <View style={styles.customerInfoCard}>
                    <View style={styles.customerInfoHeader}>
                      <Text style={styles.customerInfoLabel}>Client Code</Text>
                      <TouchableOpacity onPress={() => setUserData(null)}>
                        <Ionicons name="pencil" size={16} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.customerInfoValue}>{userData.client_code}</Text>
                    <Text style={styles.customerName}>{userData.customer_name}</Text>
                    {userData.accounts && userData.accounts.length > 0 && (
                      <Text style={styles.accountInfo}>
                        {userData.accounts.length} account(s) found
                      </Text>
                    )}
                  </View>
                )}

                {/* Client Code Input */}
                {!userData && (
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Client Code</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="card-outline"
                        size={20}
                        color={Colors.textSecondary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        value={clientCode}
                        onChangeText={setClientCode}
                        placeholder="Enter your client code (e.g., MAS075)"
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="characters"
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                )}

                {/* Show registration fields after client code verified */}
                {userData && (
                  <>
                    {/* Email Input */}
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Email Address</Text>
                      {emailOptions.length > 0 ? (
                        <View style={styles.inputWrapper}>
                          <Ionicons
                            name="mail-outline"
                            size={20}
                            color={Colors.textSecondary}
                            style={styles.inputIcon}
                          />
                          <TextInput
                            style={styles.textInput}
                            value={emailInput}
                            onChangeText={setEmailInput}
                            placeholder="Enter your email address"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </View>
                      ) : (
                        <Text style={styles.supportHintText}>No email address found for this account.</Text>
                      )}
                    </View>

                    {/* Phone Input */}
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Phone Number</Text>
                      {phoneOptions.length > 0 ? (
                        <View style={styles.inputWrapper}>
                          <Ionicons
                            name="call-outline"
                            size={20}
                            color={Colors.textSecondary}
                            style={styles.inputIcon}
                          />
                          <TextInput
                            style={styles.textInput}
                            value={phoneInput}
                            onChangeText={setPhoneInput}
                            placeholder="e.g., 0769790642"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="phone-pad"
                            autoCorrect={false}
                          />
                        </View>
                      ) : (
                        <Text style={styles.supportHintText}>No phone number found for this account.</Text>
                      )}
                    </View>

                    {needsSupport && (
                      <View style={styles.supportNotice}>
                        <Text style={styles.supportText}>{supportMessage}</Text>
                        <TouchableOpacity
                          style={styles.whatsappButton}
                          onPress={handleWhatsAppSupport}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="logo-whatsapp" size={18} color={Colors.textInverse} style={styles.whatsappIcon} />
                          <Text style={styles.whatsappButtonText}>WhatsApp Support</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Password Input */}
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Create Password</Text>
                      <View style={styles.inputWrapper}>
                        <Ionicons
                          name="lock-closed-outline"
                          size={20}
                          color={Colors.textSecondary}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={[styles.textInput, styles.passwordInput]}
                          value={password}
                          onChangeText={setPassword}
                          placeholder="Create a strong password"
                          placeholderTextColor={Colors.textMuted}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          style={styles.passwordToggle}
                        >
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color={Colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.passwordHint}>
                        Password must be at least 8 characters long
                      </Text>
                    </View>
                  </>
                )}

                {/* Register Button */}
                <View style={styles.buttonContainer}>
                  {!userData ? (
                    <CustomButton
                      title="Verify Client Code"
                      onPress={handleCheckUser}
                      variant="primary"
                      size="large"
                      style={styles.primaryButton}
                    />
                  ) : (
                    <CustomButton
                      title="Create Account"
                      onPress={handleRegister}
                      variant="primary"
                      size="large"
                      style={styles.primaryButton}
                      disabled={!canRegister}
                    />
                  )}
                </View>

                {/* Switch to Login */}
                <View style={styles.switchModeContainer}>
                  <Text style={styles.switchModeText}>Already have an account? </Text>
                  <TouchableOpacity onPress={toggleMode}>
                    <Text style={styles.switchModeLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Need help?{' '}
              <Text style={styles.footerLinkText}>Contact Support</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Reset Password Confirmation Modal */}
      <ConfirmationModal
        visible={showResetConfirm}
        type="confirm"
        title="Reset Password"
        message={`A password reset code will be sent to ${loginWithEmail ? 'your email' : 'the email associated with this phone number'}. Continue?`}
        confirmText="Send Reset Code"
        cancelText="Cancel"
        onConfirm={sendResetCode}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Reset Code Sent Success Modal */}
      <ConfirmationModal
        visible={showResetSentModal}
        type="success"
        title="Reset Code Sent"
        message="A 6-digit reset code has been sent to your email. Please check your inbox."
        confirmText="Continue"
        onConfirm={() => {
          setShowResetSentModal(false);
          navigation.navigate('ResetPassword');
        }}
        onCancel={() => setShowResetSentModal(false)}
        showCancel={false}
      />

      {/* Mismatch Confirmation Modal */}
      <ConfirmationModal
        visible={showMismatchModal}
        type="confirm"
        title="Verify Information"
        message={`The ${mismatchType === 'both' ? 'email and phone number' : mismatchType} you entered does not match our records. Are you sure this information is correct?`}
        confirmText="Yes, Continue"
        cancelText="Let me correct it"
        onConfirm={handleRegisterWithMismatch}
        onCancel={handleMismatchRetry}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...CommonStyles.safeArea,
    backgroundColor: Colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.md,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logo: {
    width: 100,
    height: 90,
    marginBottom: Spacing.sm,
  },
  tagline: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
    letterSpacing: Typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  formContainer: {
    flex: 1,
    paddingBottom: Spacing.lg,
  },
  welcomeText: {
    ...CommonStyles.h2,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitleText: {
    ...CommonStyles.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: Typography.lg * Typography.lineHeights.relaxed,
  },
  customerInfoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  customerInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  customerInfoLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wider,
  },
  customerInfoValue: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  customerName: {
    fontSize: Typography.md,
    color: Colors.text,
  },
  accountInfo: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
    letterSpacing: Typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: Typography.md,
    fontWeight: Typography.weights.regular,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  supportHintText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  supportNotice: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  supportText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  whatsappIcon: {
    marginRight: Spacing.xs,
  },
  whatsappButtonText: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textInverse,
  },
  passwordInput: {
    paddingRight: Spacing.sm,
  },
  passwordToggle: {
    padding: Spacing.xs,
  },
  switchModeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  switchModeText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  switchModeLink: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
  passwordHint: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  buttonContainer: {
    marginTop: Spacing.sm,
  },
  primaryButton: {
    marginBottom: Spacing.sm,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  footerText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footerLinkText: {
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
  loginMethodToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  toggleIcon: {
    marginRight: Spacing.xs,
  },
  toggleButtonText: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textSecondary,
  },
  toggleButtonTextActive: {
    color: Colors.textInverse,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  forgotPasswordLink: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
  forgotEmailContainer: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  forgotEmailLink: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
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
});
