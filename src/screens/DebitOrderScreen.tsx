import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import TopNavigation from '../components/TopNavigation';
import CustomButton from '../components/CustomButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { showToast } from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { apiService } from '../services/api';
import { Colors, Typography, Spacing } from '../constants/Design';

// South African Banks with Universal Branch Codes
const SA_BANKS = [
  { name: 'ABSA Bank', universal_branch: 'Universal Branch', universal_code: '632005' },
  { name: 'African Bank', universal_branch: 'Universal Branch', universal_code: '430000' },
  { name: 'Bank Zero', universal_branch: 'Universal Branch', universal_code: '888000' },
  { name: 'Bidvest Bank', universal_branch: 'Universal Branch', universal_code: '462005' },
  { name: 'Capitec Bank', universal_branch: 'Universal Branch', universal_code: '470010' },
  { name: 'Discovery Bank', universal_branch: 'Universal Branch', universal_code: '679000' },
  { name: 'First National Bank (FNB)', universal_branch: 'Universal Branch', universal_code: '250655' },
  { name: 'Investec Bank', universal_branch: 'Universal Branch', universal_code: '580105' },
  { name: 'Nedbank', universal_branch: 'Universal Branch', universal_code: '198765' },
  { name: 'Standard Bank', universal_branch: 'Universal Branch', universal_code: '051001' },
  { name: 'TymeBank', universal_branch: 'Universal Branch', universal_code: '678910' },
  { name: 'Other', universal_branch: '', universal_code: '' },
];

const ACCOUNT_TYPES = ['Cheque', 'Savings', 'Transmission'];
const DEDUCTION_DATES = ['1', '7', '15', '25'];

export default function DebitOrderScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [showAccountTypePicker, setShowAccountTypePicker] = useState(false);
  const [showDeductionDatePicker, setShowDeductionDatePicker] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Form fields
  const [accountHolder, setAccountHolder] = useState('');
  const [selectedBank, setSelectedBank] = useState<typeof SA_BANKS[0] | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedAccountType, setSelectedAccountType] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [selectedDeductionDate, setSelectedDeductionDate] = useState('');
  const [confirmationFile, setConfirmationFile] = useState<any>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleBankSelect = (bank: typeof SA_BANKS[0]) => {
    setSelectedBank(bank);
    setBranchName(bank.universal_branch);
    setBranchCode(bank.universal_code);
    setShowBankPicker(false);
  };

  // Helper function to optimize images before upload
  const optimizeImage = async (uri: string, mimeType?: string): Promise<string> => {
    try {
      // Check if it's an image based on mimeType (not PDF)
      const isImage = mimeType && mimeType.startsWith('image/');
      if (!isImage) {
        console.log('Skipping optimization - not an image:', mimeType);
        return uri; // Don't optimize PDFs
      }

      console.log('Optimizing image - Original URI:', uri);
      console.log('MIME type:', mimeType);
      
      // Compress and resize image
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [
          // Resize to max 1200px width (good for documents, much smaller file size)
          { resize: { width: 1200 } }
        ],
        {
          compress: 0.7, // 70% quality - smaller files, still readable for documents
          format: ImageManipulator.SaveFormat.JPEG, // Convert PNG to JPEG for smaller size
        }
      );

      console.log('✓ Image optimized successfully');
      console.log('Original URI:', uri);
      console.log('Optimized URI:', manipResult.uri);
      return manipResult.uri;
    } catch (error) {
      console.error('Image optimization error:', error);
      return uri; // Return original if optimization fails
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // Optimize image if it's an image file
        const optimizedUri = await optimizeImage(asset.uri, asset.mimeType);
        setConfirmationFile({ ...asset, uri: optimizedUri });
        
        if (asset.mimeType?.startsWith('image/')) {
          showToast.success('File Optimized', 'Image compressed for faster upload');
        } else {
          showToast.success('File Selected', asset.name);
        }
      }
    } catch (error) {
      console.error('Document picker error:', error);
      showToast.error('Error', 'Failed to pick document');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permission.granted) {
        showToast.error('Permission Denied', 'Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7, // Start with lower quality from camera
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // Further optimize the captured photo (always an image)
        const optimizedUri = await optimizeImage(asset.uri, 'image/jpeg');
        setConfirmationFile({ ...asset, uri: optimizedUri, mimeType: 'image/jpeg' });
        showToast.success('Photo Captured', 'Photo optimized for upload');
      }
    } catch (error) {
      console.error('Camera error:', error);
      showToast.error('Error', 'Failed to take photo');
    }
  };

  const validateForm = () => {
    if (!accountHolder.trim()) {
      showToast.error('Error', 'Please enter account holder name');
      return false;
    }

    if (!selectedBank) {
      showToast.error('Error', 'Please select your bank');
      return false;
    }

    if (!accountNumber.trim()) {
      showToast.error('Error', 'Please enter account number');
      return false;
    }

    // Validate SA account number (9-11 digits)
    if (!/^\d{9,11}$/.test(accountNumber.trim())) {
      showToast.error('Invalid Account Number', 'South African account numbers must be 9-11 digits');
      return false;
    }

    if (!selectedAccountType) {
      showToast.error('Error', 'Please select account type');
      return false;
    }

    if (!branchName.trim()) {
      showToast.error('Error', 'Please enter branch name');
      return false;
    }

    if (!branchCode.trim()) {
      showToast.error('Error', 'Please enter branch code');
      return false;
    }

    if (!selectedDeductionDate) {
      showToast.error('Error', 'Please select deduction date');
      return false;
    }

    if (!termsAccepted) {
      showToast.error('Terms Required', 'You must accept the debit order terms and conditions');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setShowConfirmModal(true);
  };

  const submitApplication = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    
    try {
      const success = await apiService.submitDebitOrder({
        account_holder: accountHolder.trim(),
        bank_name: selectedBank!.name,
        account_number: accountNumber.trim(),
        account_type: selectedAccountType,
        branch_name: branchName.trim(),
        branch_code: branchCode.trim(),
        deduction_date: selectedDeductionDate,
        confirmation_file: confirmationFile,
        terms_accepted: termsAccepted,
      });

      if (success) {
        setShowSuccessModal(true);
      } else {
        showToast.error('Error', 'Failed to submit application');
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      showToast.error('Error', error.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigation.goBack();
  };

  if (loading) {
    return (
      <>
        <TopNavigation 
          title="Apply for Debit Order" 
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Submitting application...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <TopNavigation 
        title="Apply for Debit Order" 
        subtitle="Automated monthly payments"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />
      
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={Colors.primary} />
          <Text style={styles.infoText}>
            Set up automatic monthly deductions from your bank account. Processing may take 3-5 business days.
          </Text>
        </View>

        {/* Account Holder */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Account Holder Name *</Text>
          <TextInput
            style={styles.input}
            value={accountHolder}
            onChangeText={setAccountHolder}
            placeholder="Full name as per bank account"
            autoCapitalize="words"
          />
        </View>

        {/* Bank Selection */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Select Bank *</Text>
          <TouchableOpacity 
            style={styles.picker}
            onPress={() => setShowBankPicker(true)}
          >
            <Text style={selectedBank ? styles.pickerTextSelected : styles.pickerText}>
              {selectedBank ? selectedBank.name : 'Choose your bank'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Account Number */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Account Number *</Text>
          <TextInput
            style={styles.input}
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="9-11 digits"
            keyboardType="number-pad"
            maxLength={11}
          />
          <Text style={styles.hint}>South African account numbers are typically 9-11 digits</Text>
        </View>

        {/* Account Type */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Account Type *</Text>
          <TouchableOpacity 
            style={styles.picker}
            onPress={() => setShowAccountTypePicker(true)}
          >
            <Text style={selectedAccountType ? styles.pickerTextSelected : styles.pickerText}>
              {selectedAccountType || 'Select account type'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Branch Name */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Branch Name *</Text>
          <TextInput
            style={styles.input}
            value={branchName}
            onChangeText={setBranchName}
            placeholder="Branch name"
            editable={true}
          />
          <Text style={styles.hint}>Auto-filled, but you can change if needed</Text>
        </View>

        {/* Branch Code */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Branch Code *</Text>
          <TextInput
            style={styles.input}
            value={branchCode}
            onChangeText={setBranchCode}
            placeholder="Branch code"
            keyboardType="number-pad"
            editable={true}
          />
          <Text style={styles.hint}>Auto-filled, but you can change if needed</Text>
        </View>

        {/* Deduction Date */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Deduction Date *</Text>
          <TouchableOpacity 
            style={styles.picker}
            onPress={() => setShowDeductionDatePicker(true)}
          >
            <Text style={selectedDeductionDate ? styles.pickerTextSelected : styles.pickerText}>
              {selectedDeductionDate ? `${selectedDeductionDate} of each month` : 'Select deduction date'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* File Upload */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Bank Confirmation</Text>
          <Text style={styles.hint}>Upload proof of banking (bank statement or letter)</Text>
          
          <View style={styles.uploadButtons}>
            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={handlePickDocument}
            >
              <Ionicons name="document-attach" size={24} color={Colors.primary} />
              <Text style={styles.uploadButtonText}>Choose File</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={handleTakePhoto}
            >
              <Ionicons name="camera" size={24} color={Colors.primary} />
              <Text style={styles.uploadButtonText}>Take Photo</Text>
            </TouchableOpacity>
          </View>

          {confirmationFile && (
            <View style={styles.selectedFile}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.selectedFileText} numberOfLines={1}>
                {confirmationFile.name}
              </Text>
              <TouchableOpacity onPress={() => setConfirmationFile(null)}>
                <Ionicons name="close-circle" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Terms and Conditions */}
        <View style={styles.termsContainer}>
          <TouchableOpacity 
            style={styles.termsCheckbox}
            onPress={() => setTermsAccepted(!termsAccepted)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
              {termsAccepted && <Ionicons name="checkmark" size={18} color={Colors.surface} />}
            </View>
            <Text style={styles.termsText}>
              I accept the{' '}
              <Text 
                style={styles.termsLink}
                onPress={() => setShowTermsModal(true)}
              >
                Debit Order Terms & Conditions
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        <CustomButton
          title="Submit Application"
          onPress={handleSubmit}
          size="large"
          style={styles.submitButton}
        />

        <Text style={styles.disclaimer}>
          * All fields marked with asterisk are required. Your banking details will be securely transmitted to CTECG for processing.
        </Text>
      </ScrollView>

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.termsModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Debit Order Terms & Conditions</Text>
              <TouchableOpacity onPress={() => setShowTermsModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.termsContent}>
              <Text style={styles.termsHeading}>Debit Order Authorization</Text>
              <Text style={styles.termsParagraph}>
                By accepting these terms, you authorize CTECG to debit your nominated bank account for the monthly subscription fee on the selected deduction date.
              </Text>

              <Text style={styles.termsHeading}>Payment Processing</Text>
              <Text style={styles.termsParagraph}>
                • Deductions will occur on the {selectedDeductionDate ? selectedDeductionDate + ' of each month' : 'selected day of each month'}
              </Text>
              <Text style={styles.termsParagraph}>
                • Your first deduction will be processed in the next billing cycle after approval
              </Text>
              <Text style={styles.termsParagraph}>
                • Processing may take 3-5 business days for activation
              </Text>

              <Text style={styles.termsHeading}>Your Responsibilities</Text>
              <Text style={styles.termsParagraph}>
                • Ensure sufficient funds are available on the deduction date
              </Text>
              <Text style={styles.termsParagraph}>
                • Notify CTECG immediately of any changes to your banking details
              </Text>
              <Text style={styles.termsParagraph}>
                • Failed payments may result in service suspension
              </Text>

              <Text style={styles.termsHeading}>Cancellation</Text>
              <Text style={styles.termsParagraph}>
                You may cancel this debit order authorization by providing 30 days written notice to CTECG or by contacting your bank directly.
              </Text>

              <Text style={styles.termsHeading}>Data Protection</Text>
              <Text style={styles.termsParagraph}>
                Your banking details will be securely stored and used only for processing your monthly subscription payments. We will not share your information with third parties without your consent.
              </Text>

              <Text style={styles.termsHeading}>Disputes</Text>
              <Text style={styles.termsParagraph}>
                Any disputes regarding debit order transactions must be reported to CTECG within 40 days of the transaction date. Contact our accounts department at helpdesk@ctecg.co.za.
              </Text>
            </ScrollView>
            <View style={styles.termsModalFooter}>
              <CustomButton
                title="Accept Terms"
                onPress={() => {
                  setTermsAccepted(true);
                  setShowTermsModal(false);
                }}
                size="large"
              />
              <TouchableOpacity 
                style={styles.termsDeclineButton}
                onPress={() => setShowTermsModal(false)}
              >
                <Text style={styles.termsDeclineText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Bank Picker Modal */}
      {showBankPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Your Bank</Text>
              <TouchableOpacity onPress={() => setShowBankPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {SA_BANKS.map((bank, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.pickerItem}
                  onPress={() => handleBankSelect(bank)}
                >
                  <Text style={styles.pickerItemText}>{bank.name}</Text>
                  {selectedBank?.name === bank.name && (
                    <Ionicons name="checkmark" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Account Type Picker Modal */}
      {showAccountTypePicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Account Type</Text>
              <TouchableOpacity onPress={() => setShowAccountTypePicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {ACCOUNT_TYPES.map((type, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.pickerItem}
                  onPress={() => {
                    setSelectedAccountType(type);
                    setShowAccountTypePicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{type}</Text>
                  {selectedAccountType === type && (
                    <Ionicons name="checkmark" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Deduction Date Picker Modal */}
      {showDeductionDatePicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Deduction Date</Text>
              <TouchableOpacity onPress={() => setShowDeductionDatePicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {DEDUCTION_DATES.map((date, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.pickerItem}
                  onPress={() => {
                    setSelectedDeductionDate(date);
                    setShowDeductionDatePicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{date} of each month</Text>
                  {selectedDeductionDate === date && (
                    <Ionicons name="checkmark" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showConfirmModal}
        type="confirm"
        title="Confirm Submission"
        message="Are you sure you want to submit this debit order application?"
        confirmText="Submit"
        cancelText="Cancel"
        onConfirm={submitApplication}
        onCancel={() => setShowConfirmModal(false)}
        showCancel={true}
      />

      {/* Success Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        type="success"
        title="Application Submitted"
        message="Your debit order application has been submitted successfully. Our team will process it within 3-5 business days."
        confirmText="Done"
        onConfirm={handleSuccessClose}
        onCancel={handleSuccessClose}
        showCancel={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.md,
    color: Colors.textSecondary,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.sm,
    color: Colors.primary,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold as any,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    fontSize: Typography.md,
    color: Colors.text,
  },
  hint: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
  },
  pickerText: {
    fontSize: Typography.md,
    color: Colors.textMuted,
  },
  pickerTextSelected: {
    fontSize: Typography.md,
    color: Colors.text,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  uploadButtonText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.medium as any,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: Spacing.sm,
    borderRadius: 8,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  selectedFileText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.success,
  },
  submitButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  disclaimer: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.xl,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    width: '85%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text,
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerItemText: {
    fontSize: Typography.md,
    color: Colors.text,
  },
  termsContainer: {
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  termsCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.primary,
    textDecorationLine: 'underline',
    fontWeight: Typography.weights.medium as any,
  },
  termsModal: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  termsContent: {
    padding: Spacing.lg,
    maxHeight: 500,
  },
  termsHeading: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  termsParagraph: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    lineHeight: 20,
  },
  termsModalFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  termsDeclineButton: {
    alignItems: 'center',
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  termsDeclineText: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
  },
});
