import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import TopNavigation from '../components/TopNavigation';
import CustomButton from '../components/CustomButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { showToast } from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { Colors, Typography, CommonStyles, Spacing } from '../constants/Design';

export default function LinkAccountScreen() {
  const navigation = useNavigation();
  const { loadLinkedAccounts } = useAuth();
  const [step, setStep] = useState<'input' | 'email' | 'otp'>('input');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const [accountId, setAccountId] = useState('');
  const [emailOptions, setEmailOptions] = useState<Array<{display: string; value: string}>>([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [targetAccount, setTargetAccount] = useState<any>(null);
  const [otpCode, setOtpCode] = useState('');

  const handleRequestLink = async () => {
    if (!accountId.trim()) {
      showToast.error('Error', 'Please enter an account ID');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.requestAccountLink(accountId.trim().toUpperCase());
      
      if (response.success && response.data) {
        setEmailOptions(response.data.email_options);
        setTargetAccount(response.data.target_account);
        setStep('email');
      } else {
        showToast.error('Error', response.message || 'Failed to find account');
      }
    } catch (error: any) {
      showToast.error('Error', error.message || 'Failed to request account link');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (email: string) => {
    setLoading(true);
    setSelectedEmail(email);
    
    try {
      const response = await apiService.sendAccountLinkOTP(accountId.trim().toUpperCase(), email, targetAccount);
      
      if (response.success) {
        setStep('otp');
        showToast.success('Success', 'Verification code sent to your email');
      } else {
        showToast.error('Error', response.message || 'Failed to send verification code');
      }
    } catch (error: any) {
      showToast.error('Error', error.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      showToast.error('Error', 'Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.verifyAccountLinkOTP(
        accountId.trim().toUpperCase(),
        otpCode.trim()
      );
      
      if (response.success) {
        setShowSuccessModal(true);
      } else {
        showToast.error('Error', response.message || 'Invalid or expired verification code');
      }
    } catch (error: any) {
      showToast.error('Error', error.message || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <TopNavigation 
          title="Link Account" 
          subtitle="Add another account" 
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
        </View>
      </>
    );
  }

  return (
    <>
      <TopNavigation 
        title="Link Account" 
        subtitle="Add another account" 
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {step === 'input' && (
          <View style={styles.stepContainer}>
            <Text style={styles.instructionText}>
              Enter the account ID you want to link to your current account
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Account ID</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., MAS088"
                value={accountId}
                onChangeText={setAccountId}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <CustomButton
              title="Continue"
              onPress={handleRequestLink}
              size="large"
              style={styles.button}
            />
          </View>
        )}

        {step === 'email' && (
          <View style={styles.stepContainer}>
            <Text style={styles.instructionText}>
              Select the email address to receive the verification code
            </Text>
            
            <View style={styles.accountInfo}>
              <Text style={styles.accountLabel}>Linking to:</Text>
              <Text style={styles.accountName}>{targetAccount?.name}</Text>
              <Text style={styles.accountId}>{targetAccount?.invoicing_id}</Text>
            </View>

            <View style={styles.emailList}>
              {emailOptions.map((emailOption, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.emailOption}
                  onPress={() => handleSendOTP(emailOption.value)}
                >
                  <Text style={styles.emailText}>{emailOption.display}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <CustomButton
              title="Back"
              onPress={() => setStep('input')}
              variant="outline"
              size="large"
              style={styles.button}
            />
          </View>
        )}

        {step === 'otp' && (
          <View style={styles.stepContainer}>
            <Text style={styles.instructionText}>
              Enter the 6-digit verification code sent to {selectedEmail.replace(/(\w{1})\w+(@)/, '$1******$2')}
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="000000"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>

            <CustomButton
              title="Verify & Link"
              onPress={handleVerifyOTP}
              size="large"
              style={styles.button}
            />

            <CustomButton
              title="Back"
              onPress={() => {
                setStep('email');
                setOtpCode('');
              }}
              variant="outline"
              size="large"
              style={styles.button}
            />
          </View>
        )}
      </ScrollView>

      {/* Success Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        type="success"
        title="Accounts Linked!"
        message="Your accounts have been linked successfully. You can now switch between them."
        confirmText="Done"
        onConfirm={async () => {
          setShowSuccessModal(false);
          await loadLinkedAccounts();
          navigation.goBack();
        }}
        onCancel={() => setShowSuccessModal(false)}
        showCancel={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  stepContainer: {
    marginTop: Spacing.lg,
  },
  instructionText: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.medium,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    fontSize: Typography.md,
    color: Colors.text,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: Typography.xl,
    letterSpacing: 8,
    fontWeight: Typography.weights.bold,
  },
  accountInfo: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  accountLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  accountName: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  accountId: {
    fontSize: Typography.md,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
  },
  emailList: {
    marginBottom: Spacing.lg,
  },
  emailOption: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emailText: {
    fontSize: Typography.md,
    color: Colors.text,
    textAlign: 'center',
  },
  button: {
    marginBottom: Spacing.md,
  },
});
