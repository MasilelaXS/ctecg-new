import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Design';
import CustomButton from '../components/CustomButton';
import { showToast } from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { OtpCodeField } from '../components/AuthFields';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyOTP'>;

const VerifyOTPScreen: React.FC<Props> = ({ route, navigation }) => {
  const { email, password } = route.params;
  const { login } = useAuth();
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleVerifyOTP = async () => {
    if (!otpCode.trim()) {
      showToast.error('Error', 'Please enter the OTP code');
      return;
    }

    if (otpCode.length !== 6) {
      showToast.error('Error', 'OTP code must be 6 digits');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.verifyOTP(email, otpCode);

      if (response.success) {
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      showToast.error('Verification Failed', error.message || 'Invalid OTP code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessConfirm = async () => {
    setShowSuccessModal(false);
    // Auto-login after successful verification using AuthContext
    try {
      await login(email, password);
      // AuthContext will handle navigation automatically
    } catch (error: any) {
      showToast.error('Login Error', error.message || 'Failed to login after verification');
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.resendOTP(email);
      if (response.success) {
        showToast.success('Success', 'OTP code has been resent to your email');
      }
    } catch (error: any) {
      showToast.error('Error', error.message || 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to{'\n'}
            <Text style={styles.email}>{email}</Text>
          </Text>

          <OtpCodeField
            label="Verification Code"
            value={otpCode}
            onChangeText={setOtpCode}
            autoFocus
            disabled={isLoading}
          />

          <CustomButton
            title={isLoading ? 'Verifying...' : 'Verify Email'}
            onPress={handleVerifyOTP}
            disabled={isLoading}
          />

          <TouchableOpacity
            onPress={handleResendOTP}
            disabled={isLoading}
            style={styles.resendButton}
          >
            <Text style={styles.resendText}>
              Didn't receive the code? <Text style={styles.resendLink}>Resend</Text>
            </Text>
          </TouchableOpacity>

          {isLoading && (
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        type="success"
        title="Email Verified!"
        message="Your email has been verified successfully. You will now be logged in."
        confirmText="Continue"
        onConfirm={handleSuccessConfirm}
        onCancel={() => setShowSuccessModal(false)}
        showCancel={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 24,
  },
  email: {
    fontWeight: '600',
    color: Colors.primary,
  },
  resendButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#666',
  },
  resendLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
  loader: {
    marginTop: 20,
  },
});

export default VerifyOTPScreen;
