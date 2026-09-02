import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../constants/Design';
import TopNavigation from '../components/TopNavigation';
import YocoPaymentWebView from '../components/YocoPaymentWebView';
import { showToast } from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function MakePaymentScreen({ navigation }: any) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Account Payment');
  const [isLoading, setIsLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [showPaymentWebView, setShowPaymentWebView] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successAmount, setSuccessAmount] = useState('');

  useEffect(() => {
    loadPaymentHistory();
  }, []);

  const loadPaymentHistory = async () => {
    try {
      const response = await apiService.getYocoPaymentHistory(5);
      if (response.success && response.data) {
        setPaymentHistory(response.data.payments);
      }
    } catch (error) {
      console.error('Failed to load payment history:', error);
    }
  };

  const handleCreatePayment = async () => {
    const amountNum = parseFloat(amount);
    
    if (!amountNum || amountNum <= 0) {
      showToast.error('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (amountNum < 5) {
      showToast.error('Minimum Amount', 'Minimum payment amount is R5.00');
      return;
    }

    setIsLoading(true);

    try {
      const paymentInfo = await apiService.getPaymentInfo();
      if (!paymentInfo.success || !paymentInfo.data?.enabled) {
        showToast.warning(
          'Payments Unavailable',
          'Yoco payments are temporarily unavailable. Please contact Customer Care for assistance.',
        );
        return;
      }

      const response = await apiService.createYocoCheckout(
        amountNum,
        description || 'Account Payment',
        {
          invoicing_id: user?.invoicingid,
          customer_name: user?.email || user?.invoicingid,
        }
      );

      if (response.success && response.data) {
        setCheckoutUrl(response.data.redirect_url);
        setPaymentReference(response.data.payment_reference);
        setShowPaymentWebView(true);
      } else {
        showToast.error('Payment Error', response.error || 'Failed to create payment');
      }
    } catch (error: any) {
      console.error('Payment creation error:', error);
      showToast.error('Error', 'Failed to initiate payment. Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = async (reference: string) => {
    setShowPaymentWebView(false);
    
    // Wait a moment for webhook to process
    setTimeout(async () => {
      try {
        const statusResponse = await apiService.getYocoPaymentStatus(reference);
        
        if (statusResponse.success && statusResponse.data) {
          const { status } = statusResponse.data;
          
          if (status === 'completed') {
            setSuccessAmount(parseFloat(amount).toFixed(2));
            setShowSuccessModal(true);
          } else {
            showToast.info('Payment Processing', 'Your payment is being processed. You will be notified once complete.');
            loadPaymentHistory();
          }
        }
      } catch (error) {
        console.error('Failed to check payment status:', error);
        showToast.info('Payment Submitted', 'Your payment has been submitted and is being processed.');
      }
    }, 2000);
  };

  const handlePaymentCancel = () => {
    setShowPaymentWebView(false);
    showToast.info('Payment Cancelled', 'You can try again when ready.');
  };

  const handlePaymentError = (error: string) => {
    setShowPaymentWebView(false);
    showToast.error('Payment Error', error || 'An error occurred during payment.');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return Colors.success;
      case 'pending':
        return Colors.warning;
      case 'failed':
        return Colors.error;
      case 'cancelled':
        return Colors.textSecondary;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'failed':
        return 'close-circle';
      case 'cancelled':
        return 'ban';
      default:
        return 'help-circle';
    }
  };

  return (
    <>
      <TopNavigation 
        title="Make a Payment" 
        subtitle="Pay your account securely" 
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Payment Form */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          
          {/* Amount Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Amount (ZAR)</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>R</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          {/* Description Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Account Payment"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Quick Amount Buttons */}
          <View style={styles.quickAmounts}>
            <Text style={styles.quickAmountsLabel}>Quick amounts:</Text>
            <View style={styles.quickAmountsRow}>
              {[249, 449, 599, 799].map((quickAmount) => (
                <TouchableOpacity
                  key={quickAmount}
                  style={styles.quickAmountButton}
                  onPress={() => setAmount(quickAmount.toString())}
                >
                  <Text style={styles.quickAmountText}>R{quickAmount}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Pay Button */}
          <TouchableOpacity
            style={[styles.payButton, isLoading && styles.payButtonDisabled]}
            onPress={handleCreatePayment}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
                <Text style={styles.payButtonText}>Pay Securely with Yoco</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Security Info */}
          <View style={styles.securityInfo}>
            <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
            <Text style={styles.securityText}>
              Powered by Yoco - Your payment is secure and encrypted
            </Text>
          </View>
        </View>

        {/* Payment History */}
        {paymentHistory.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Recent Payments</Text>
            
            {paymentHistory.map((payment, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <Ionicons
                    name={getStatusIcon(payment.status)}
                    size={24}
                    color={getStatusColor(payment.status)}
                  />
                  <View style={styles.historyDetails}>
                    <Text style={styles.historyDescription}>{payment.invoice_reference}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(payment.created_at).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyAmount}>
                    R{parseFloat(payment.amount).toFixed(2)}
                  </Text>
                  <Text style={[styles.historyStatus, { color: getStatusColor(payment.status) }]}>
                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Yoco Payment WebView */}
      {showPaymentWebView && (
        <YocoPaymentWebView
          visible={showPaymentWebView}
          checkoutUrl={checkoutUrl}
          paymentReference={paymentReference}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
          onError={handlePaymentError}
        />
      )}

      {/* Payment Success Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        type="success"
        title="Payment Successful!"
        message={`Your payment of R${successAmount} has been processed successfully.`}
        confirmText="Done"
        onConfirm={() => {
          setShowSuccessModal(false);
          setAmount('');
          setDescription('Account Payment');
          loadPaymentHistory();
        }}
        onCancel={() => setShowSuccessModal(false)}
        showCancel={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  formContainer: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.md,
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
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
  },
  currencySymbol: {
    fontSize: Typography.xl,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginRight: Spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: Typography.xl,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    paddingVertical: Spacing.md,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    fontSize: Typography.md,
    color: Colors.text,
  },
  quickAmounts: {
    marginBottom: Spacing.lg,
  },
  quickAmountsLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: Typography.md,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
    marginBottom: Spacing.md,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: '#FFFFFF',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  securityText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  historyCard: {
    marginTop: Spacing.xl,
  },
  historyTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  historyDetails: {
    flex: 1,
  },
  historyDescription: {
    fontSize: Typography.md,
    color: Colors.text,
    marginBottom: 4,
  },
  historyDate: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontSize: Typography.md,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
    marginBottom: 4,
  },
  historyStatus: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
  },
});
