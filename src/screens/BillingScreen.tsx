import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TopNavigation from '../components/TopNavigation';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import PaymentWebView from '../components/PaymentWebView';
import { apiService } from '../services/api';
import { DetailedBillingData, BillingInvoice, PaymentInfo } from '../types/api';
import { Colors, Typography, Spacing, CommonStyles } from '../constants/Design';

export default function BillingScreen() {
  const [billingData, setBillingData] = useState<DetailedBillingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'invoices' | 'history'>('overview');
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showPaymentWebView, setShowPaymentWebView] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [currentPaymentData, setCurrentPaymentData] = useState<any>(null);

  useEffect(() => {
    loadBillingData();
    loadPaymentInfo();
  }, []);

  const loadBillingData = async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      console.log('Loading detailed billing data...');
      const response = await apiService.getDetailedBillingData();
      console.log('Billing API response:', response);
      
      if (response.success && response.data) {
        console.log('Setting billing data:', response.data);
        setBillingData(response.data);
      } else {
        console.error('Billing API error:', response.message);
        Alert.alert('Error', response.message || 'Failed to load billing data');
      }
    } catch (error) {
      console.error('Billing load error:', error);
      Alert.alert('Error', 'Failed to load billing data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadBillingData(true);
  };

  const loadPaymentInfo = async () => {
    try {
      const response = await apiService.getPaymentInfo();
      if (response.success && response.data) {
        setPaymentInfo(response.data);
      }
    } catch (error) {
      console.error('Payment info load error:', error);
    }
  };

  const handleMakePayment = async (amount?: number) => {
    console.log('🔵 handleMakePayment called with amount:', amount);
    try {
      // Check if server is available first
      if (!billingData) {
        console.log('⚠️ No billing data available, checking server status...');
        Alert.alert(
          'Service Unavailable',
          'Unable to load billing information. The server may be temporarily unavailable. Please try again in a few moments.',
          [
            {
              text: 'Retry',
              onPress: async () => {
                await loadBillingData(true);
                if (billingData) {
                  handleMakePayment(amount);
                }
              }
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
        return;
      }

      if (!paymentInfo || !billingData) {
        console.log('⚠️ Missing payment info or billing data, loading...');
        await loadPaymentInfo();
        await loadBillingData();
      }

      // If no amount specified and there's a custom amount in the input field, use that
      if (!amount && customAmount) {
        const parsedAmount = parseFloat(customAmount);
        if (parsedAmount >= 5) {
          amount = parsedAmount;
        } else {
          Alert.alert('Invalid Amount', 'Please enter a valid amount (minimum R5.00)');
          return;
        }
      }

      // If still no amount specified, show error
      if (!amount) {
        Alert.alert('Amount Required', 'Please enter a payment amount');
        return;
      }

      console.log('📊 Processing payment for amount:', amount);

      // Check if multiple emails are available for selection
      if (!billingData) {
        Alert.alert('Error', 'Billing data not available');
        return;
      }

      const billingEmail = billingData.billing_info.billing_email;
      
      // Handle different email scenarios based on new format
      if (billingEmail.has_email && billingEmail.email_count === 1) {
        // Single email - use it directly
        await processPayment(amount, billingEmail.primary_email!);
      } else if (billingEmail.has_email && billingEmail.email_count > 1) {
        // Multiple emails - show selection dialog
        Alert.alert(
          'Select Email Address',
          'Choose which email to use for payment confirmation:',
          [
            ...billingEmail.all_emails.map((email) => ({
              text: email,
              onPress: () => processPayment(amount!, email)
            })),
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      } else {
        // No email on file - require user input
        showEmailInputDialog(amount);
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      Alert.alert('Error', 'Failed to initiate payment process');
    }
  };

  const showAmountInputDialog = () => {
    console.log('💰 Showing amount input dialog');
    
    // Check if Alert.prompt is available
    if (typeof Alert.prompt !== 'function') {
      console.log('❌ Alert.prompt not available, showing fallback options');
      // Fallback for platforms that don't support Alert.prompt
      Alert.alert(
        'Payment Amount',
        'Select a payment amount:',
        [
          {
            text: 'R100',
            onPress: () => {
              console.log('💰 Selected R100');
              handleMakePayment(100);
            }
          },
          {
            text: 'R200',
            onPress: () => {
              console.log('💰 Selected R200');
              handleMakePayment(200);
            }
          },
          {
            text: 'R500',
            onPress: () => {
              console.log('💰 Selected R500');
              handleMakePayment(500);
            }
          },
          {
            text: 'R1000',
            onPress: () => {
              console.log('💰 Selected R1000');
              handleMakePayment(1000);
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    // Try using Alert.prompt
    try {
      console.log('✅ Alert.prompt is available, showing input dialog');
      Alert.prompt(
        'Payment Amount',
        'Enter the amount you want to pay (minimum R5.00):',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Continue',
            onPress: (amountText?: string) => {
              console.log('💰 Amount entered:', amountText);
              if (amountText && amountText.trim()) {
                const amount = parseFloat(amountText.trim());
                if (amount >= 5) {
                  handleMakePayment(amount);
                } else {
                  Alert.alert('Invalid Amount', 'Please enter a valid amount (minimum R5.00)');
                }
              } else {
                Alert.alert('Required', 'Please enter an amount');
              }
            }
          }
        ],
        'plain-text',
        '',
        'numeric'
      );
    } catch (error) {
      console.log('❌ Alert.prompt failed, showing fallback alert:', error);
      // Fallback for platforms that don't support Alert.prompt
      Alert.alert(
        'Payment Amount',
        'Select a payment amount:',
        [
          {
            text: 'R100',
            onPress: () => handleMakePayment(100)
          },
          {
            text: 'R200',
            onPress: () => handleMakePayment(200)
          },
          {
            text: 'R500',
            onPress: () => handleMakePayment(500)
          },
          {
            text: 'R1000',
            onPress: () => handleMakePayment(1000)
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    }
  };

  const showEmailInputDialog = (amount: number) => {
    Alert.prompt(
      'Email Required',
      'Please enter your email address for payment confirmation:',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Continue',
          onPress: (email?: string) => {
            if (email && email.trim()) {
              // Basic email validation
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (emailRegex.test(email.trim())) {
                processPayment(amount, email.trim());
              } else {
                Alert.alert('Invalid Email', 'Please enter a valid email address');
              }
            } else {
              Alert.alert('Required', 'Email address is required for payment processing');
            }
          }
        }
      ],
      'plain-text',
      '',
      'email-address'
    );
  };

  const processPayment = async (amount: number, selectedEmail?: string) => {
    try {
      // Show loading state on button
      setIsPaymentLoading(true);

      const paymentRequest: any = {
        amount: amount,
        description: 'CTECG Account Payment'
      };

      if (selectedEmail) {
        paymentRequest.email = selectedEmail;
      }

      const response = await apiService.createPayment(paymentRequest);

      if (response.success && response.data) {
        setCurrentPaymentData(response.data);
        setShowPaymentWebView(true);
      } else {
        const errorMessage = response.message || 'Failed to create payment';
        Alert.alert(
          'Payment Setup Error',
          errorMessage.includes('network') ? 
            'Unable to connect to payment server. Please check your internet connection.' :
            errorMessage,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Retry', 
              onPress: () => processPayment(amount, selectedEmail)
            }
          ]
        );
      }
    } catch (error) {
      console.error('Payment creation error:', error);
      
      let errorMessage = 'Failed to create payment';
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        }
      }
      
      Alert.alert(
        'Connection Error',
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retry', 
            onPress: () => handleMakePayment(amount)
          }
        ]
      );
    } finally {
      // Always reset loading state
      setIsPaymentLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentId: string) => {
    setIsPaymentLoading(false);
    setShowPaymentWebView(false);
    setCurrentPaymentData(null);
    setCustomAmount(''); // Clear the custom amount input
    
    // Get payment amount for display
    const paymentAmount = currentPaymentData?.amount || 'your payment';
    
    Alert.alert(
      'Payment Successful! 🎉',
      `Your payment of R${typeof paymentAmount === 'number' ? paymentAmount.toFixed(2) : paymentAmount} has been processed successfully.\n\nPayment ID: ${paymentId}\n\nYour account will be updated within a few minutes.`,
      [
        {
          text: 'View Receipt',
          onPress: () => {
            // You can implement receipt viewing here
            Alert.alert('Receipt', `Payment ID: ${paymentId}\nAmount: R${paymentAmount}\nStatus: Successful\nProcessed by: PayFast`);
          }
        },
        {
          text: 'Done',
          style: 'default',
          onPress: () => {
            // Refresh billing data
            loadBillingData(true);
            loadPaymentInfo();
          }
        }
      ]
    );
  };

  const handlePaymentCancel = () => {
    setIsPaymentLoading(false);
    setShowPaymentWebView(false);
    setCurrentPaymentData(null);
    
    Alert.alert(
      'Payment Cancelled',
      'Your payment was cancelled. No charges were made to your account.',
      [
        { text: 'OK' },
        {
          text: 'Try Again',
          onPress: () => {
            // Offer to retry the payment
            if (currentPaymentData) {
              setTimeout(() => {
                setShowPaymentWebView(true);
              }, 500);
            }
          }
        }
      ]
    );
  };

  const handlePaymentError = (error: string) => {
    setIsPaymentLoading(false);
    setShowPaymentWebView(false);
    setCurrentPaymentData(null);
    
    // Provide user-friendly error messages and actions
    let title = 'Payment Error';
    let message = error || 'There was an error processing your payment. Please try again.';
    let buttons: any[] = [{ text: 'OK' }];
    
    // Customize message and actions based on error type
    if (error.includes('network') || error.includes('connection')) {
      title = 'Connection Error';
      message = 'Unable to connect to the payment server. Please check your internet connection and try again.';
      buttons = [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Retry', 
          onPress: () => {
            // Retry the last payment
            if (currentPaymentData) {
              setShowPaymentWebView(true);
            }
          }
        }
      ];
    } else if (error.includes('timeout')) {
      title = 'Payment Timeout';
      message = 'The payment request timed out. Your payment may still be processing. Please check your account in a few minutes.';
      buttons = [
        { text: 'OK' },
        { 
          text: 'Refresh Account', 
          onPress: () => {
            loadBillingData(true);
            loadPaymentInfo();
          }
        }
      ];
    } else if (error.includes('declined')) {
      title = 'Payment Declined';
      message = 'Your payment was declined by your bank or card issuer. Please check your payment details or try a different payment method.';
    } else if (error.includes('insufficient')) {
      title = 'Insufficient Funds';
      message = 'Your payment was declined due to insufficient funds. Please check your account balance or try a different payment method.';
    }
    
    Alert.alert(title, message, buttons);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return Colors.success;
      case 'overdue':
        return Colors.error;
      case 'pending':
      case 'outstanding':
        return Colors.warning;
      default:
        return Colors.textSecondary;
    }
  };

  const getAccountStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'current':
        return Colors.success;
      case 'outstanding':
        return Colors.warning;
      case 'credit':
        return Colors.primary;
      default:
        return Colors.textSecondary;
    }
  };

  const getBalanceDisplayText = (balance: number) => {
    if (balance < 0) {
      return 'Amount Due'; // Negative = Client owes money
    } else if (balance > 0) {
      return 'Credit Balance'; // Positive = Client has credit
    } else {
      return 'Current Balance'; // Zero = Account is current
    }
  };

  const getBalanceColor = (balance: number) => {
    if (balance < 0) {
      return Colors.warning; // Client owes money (debt)
    } else if (balance > 0) {
      return Colors.success; // Client has credit
    } else {
      return Colors.success; // Account is current
    }
  };

  const formatCurrency = (amount: number) => {
    return `R${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderInvoiceItem = (invoice: BillingInvoice) => (
    <View key={invoice.invoice_number} style={styles.invoiceItem}>
      <View style={styles.invoiceHeader}>
        <Text style={styles.invoiceNumber}>#{invoice.invoice_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) }]}>
          <Text style={styles.statusText}>{invoice.status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.invoiceDetails}>
        <View style={styles.invoiceRow}>
          <Text style={styles.invoiceLabel}>Amount</Text>
          <Text style={styles.invoiceValue}>{formatCurrency(invoice.amount)}</Text>
        </View>
        <View style={styles.invoiceRow}>
          <Text style={styles.invoiceLabel}>Paid</Text>
          <Text style={styles.invoiceValue}>{formatCurrency(invoice.amount_paid)}</Text>
        </View>
        {invoice.outstanding_amount > 0 && (
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceLabel}>Outstanding</Text>
            <Text style={[styles.invoiceValue, { color: Colors.error }]}>
              {formatCurrency(invoice.outstanding_amount)}
            </Text>
          </View>
        )}
        <View style={styles.invoiceRow}>
          <Text style={styles.invoiceLabel}>Invoice Date</Text>
          <Text style={styles.invoiceValue}>{formatDate(invoice.invoice_date)}</Text>
        </View>
        {invoice.payment_date && (
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceLabel}>Payment Date</Text>
            <Text style={styles.invoiceValue}>{formatDate(invoice.payment_date)}</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return <LoadingSpinner message="Loading billing data..." />;
  }

  if (!billingData) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <TopNavigation title="Billing" subtitle="Manage your payments" />
        <View style={styles.content}>
          <Text style={styles.comingSoon}>No billing data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { account_summary, invoices, billing_info, payment_history, alerts } = billingData;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <TopNavigation title="Billing" subtitle="Manage your payments" />

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'overview' && styles.activeTab]}
          onPress={() => setSelectedTab('overview')}
        >
          <Text style={[styles.tabText, selectedTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'invoices' && styles.activeTab]}
          onPress={() => setSelectedTab('invoices')}
        >
          <Text style={[styles.tabText, selectedTab === 'invoices' && styles.activeTabText]}>
            Invoices
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'history' && styles.activeTab]}
          onPress={() => setSelectedTab('history')}
        >
          <Text style={[styles.tabText, selectedTab === 'history' && styles.activeTabText]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {selectedTab === 'overview' && (
          <>
            {/* Account Summary */}
            <Card title="Account Summary">
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{getBalanceDisplayText(account_summary.current_balance)}</Text>
                  <Text style={[styles.summaryValue, { 
                    color: getBalanceColor(account_summary.current_balance)
                  }]}>
                    {formatCurrency(Math.abs(account_summary.current_balance))}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getAccountStatusColor(account_summary.account_status) }]}>
                    <Text style={styles.statusText}>{account_summary.account_status.toUpperCase()}</Text>
                  </View>
                </View>
                {/* Only show debt-related info when client owes money */}
                {account_summary.current_balance < 0 && account_summary.client_owes_amount > 0 && 
                 account_summary.client_owes_amount !== Math.abs(account_summary.current_balance) && (
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Amount Due</Text>
                    <Text style={[styles.summaryValue, { color: Colors.warning }]}>
                      {formatCurrency(account_summary.client_owes_amount)}
                    </Text>
                  </View>
                )}
                {/* Only show credit info if account actually has positive balance (no debt) */}
                {account_summary.current_balance > 0 && (
                  <>
                    {account_summary.we_owe_client_amount > 0 && 
                     account_summary.we_owe_client_amount !== account_summary.current_balance && (
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Additional Credit</Text>
                        <Text style={[styles.summaryValue, { color: Colors.success }]}>
                          {formatCurrency(account_summary.we_owe_client_amount)}
                        </Text>
                      </View>
                    )}
                    {account_summary.credit_remaining > 0 && (
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Credit Remaining</Text>
                        <Text style={[styles.summaryValue, { color: Colors.success }]}>
                          {formatCurrency(account_summary.credit_remaining)}
                        </Text>
                      </View>
                    )}
                  </>
                )}
                {/* Show credit remaining only for zero balance accounts */}
                {account_summary.current_balance === 0 && account_summary.credit_remaining > 0 && (
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Credit Remaining</Text>
                    <Text style={[styles.summaryValue, { color: Colors.success }]}>
                      {formatCurrency(account_summary.credit_remaining)}
                    </Text>
                  </View>
                )}
              </View>
            </Card>

            {/* Make Payment Section */}
            <Card title="Make Payment">
              <View style={styles.paymentSection}>
                {!billingData ? (
                  <Text style={[styles.paymentText, { color: Colors.warning }]}>
                    Loading payment information...
                  </Text>
                ) : (
                  <>
                    {/* Status Message */}
                    <Text style={styles.paymentText}>
                      {billingData.account_summary.current_balance < 0 
                        ? `Outstanding Balance: ${formatCurrency(Math.abs(billingData.account_summary.current_balance))}`
                        : billingData.account_summary.current_balance > 0
                          ? `Account Credit: ${formatCurrency(billingData.account_summary.current_balance)}`
                          : 'Account is current'
                      }
                    </Text>

                    {/* Amount Input */}
                    <View style={styles.amountInputContainer}>
                      <Text style={styles.inputLabel}>
                        {billingData.account_summary.current_balance < 0 
                          ? 'Payment Amount (or enter custom amount)'
                          : 'Amount to Add'
                        }
                      </Text>
                      <TextInput
                        style={styles.amountInput}
                        value={customAmount}
                        onChangeText={setCustomAmount}
                        placeholder={billingData.account_summary.current_balance < 0 
                          ? `Default: ${formatCurrency(Math.abs(billingData.account_summary.current_balance))}`
                          : 'Enter amount (minimum R5.00)'
                        }
                        keyboardType="numeric"
                        editable={!isPaymentLoading}
                      />
                    </View>

                    {/* Single Payment Button */}
                    <TouchableOpacity 
                      style={[
                        styles.paymentButton,
                        { 
                          backgroundColor: billingData.account_summary.current_balance < 0 
                            ? Colors.warning 
                            : Colors.success,
                          marginTop: 16 
                        },
                        isPaymentLoading && styles.paymentButtonDisabled,
                        (!customAmount || parseFloat(customAmount) < 5) && { backgroundColor: Colors.textMuted }
                      ]}
                      onPress={() => {
                        const amount = customAmount && customAmount.trim() !== ''
                          ? parseFloat(customAmount) 
                          : billingData.account_summary.current_balance < 0 
                            ? Math.abs(billingData.account_summary.current_balance)
                            : 0;
                        
                        if (amount >= 5) {
                          handleMakePayment(amount);
                        }
                      }}
                      disabled={
                        isPaymentLoading || 
                        Boolean((!customAmount || customAmount.trim() === '') && billingData.account_summary.current_balance >= 0) || 
                        Boolean(customAmount && customAmount.trim() !== '' && parseFloat(customAmount) < 5)
                      }
                    >
                      <Ionicons 
                        name={billingData.account_summary.current_balance < 0 ? "card" : "add-circle"} 
                        size={20} 
                        color="white" 
                      />
                      <Text style={styles.paymentButtonText}>
                        {isPaymentLoading 
                          ? 'Processing...' 
                          : (() => {
                              const hasValidAmount = customAmount && customAmount.trim() !== '' && parseFloat(customAmount) >= 5;
                              if (hasValidAmount) {
                                return `Pay ${formatCurrency(parseFloat(customAmount))}`;
                              } else if (billingData.account_summary.current_balance < 0 && (!customAmount || customAmount.trim() === '')) {
                                return `Pay Outstanding (${formatCurrency(Math.abs(billingData.account_summary.current_balance))})`;
                              } else {
                                return 'Enter Amount';
                              }
                            })()
                        }
                      </Text>
                    </TouchableOpacity>

                    <Text style={[styles.paymentNote, { marginTop: 16 }]}>
                      Payments are processed securely through PayFast
                    </Text>
                  </>
                )}
              </View>
            </Card>

            {/* Billing Information */}
            <Card title="Billing Information">
              <View style={styles.billingInfo}>
                <View style={styles.billingRow}>
                  <Text style={styles.billingLabel}>Package Amount</Text>
                  <Text style={styles.billingValue}>{formatCurrency(billing_info.package_amount)}</Text>
                </View>
                <View style={styles.billingRow}>
                  <Text style={styles.billingLabel}>Billing Cycle</Text>
                  <Text style={styles.billingValue}>{billing_info.billing_cycle}</Text>
                </View>
                <View style={styles.billingRow}>
                  <Text style={styles.billingLabel}>Next Billing Date</Text>
                  <Text style={styles.billingValue}>{formatDate(billing_info.next_billing_date)}</Text>
                </View>
                <View style={styles.billingRow}>
                  <Text style={styles.billingLabel}>Payment Method</Text>
                  <Text style={styles.billingValue}>{billing_info.payment_method}</Text>
                </View>
                <View style={styles.billingRow}>
                  <Text style={styles.billingLabel}>Billing Email</Text>
                  <TouchableOpacity 
                    style={styles.billingValueContainer}
                    onPress={() => {
                      if (typeof billing_info.billing_email === 'object' && billing_info.billing_email?.all_emails) {
                        Alert.alert(
                          'All Billing Emails',
                          billing_info.billing_email.all_emails.join('\n'),
                          [{ text: 'OK' }]
                        );
                      }
                    }}
                  >
                    <Text style={styles.billingValue}>
                      {typeof billing_info.billing_email === 'object' ? 
                        billing_info.billing_email.display_text || 'N/A' : 
                        billing_info.billing_email || 'N/A'}
                    </Text>
                    {typeof billing_info.billing_email === 'object' && billing_info.billing_email?.email_count > 1 && (
                      <Text style={styles.emailCount}>({billing_info.billing_email.email_count} emails)</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </Card>

            {/* Alerts */}
            {(alerts.has_overdue || alerts.has_unpaid_invoices || alerts.client_owes_money || alerts.we_owe_client || alerts.payment_due_soon || alerts.low_credit) && (
              <Card title="Alerts" variant="highlight">
                {alerts.has_overdue && (
                  <View style={styles.alertItem}>
                    <Ionicons name="warning" size={20} color={Colors.error} />
                    <Text style={[styles.alertText, { color: Colors.error }]}>
                      You have overdue invoices
                    </Text>
                  </View>
                )}
                {alerts.has_unpaid_invoices && !alerts.has_overdue && (
                  <View style={styles.alertItem}>
                    <Ionicons name="warning-outline" size={20} color={Colors.warning} />
                    <Text style={[styles.alertText, { color: Colors.warning }]}>
                      You have unpaid invoices
                    </Text>
                  </View>
                )}
                {alerts.client_owes_money && (
                  <View style={styles.alertItem}>
                    <Ionicons name="card-outline" size={20} color={Colors.warning} />
                    <Text style={[styles.alertText, { color: Colors.warning }]}>
                      Payment due: {formatCurrency(account_summary.client_owes_amount)}
                    </Text>
                  </View>
                )}
                {alerts.we_owe_client && (
                  <View style={styles.alertItem}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                    <Text style={[styles.alertText, { color: Colors.success }]}>
                      Credit available: {formatCurrency(account_summary.we_owe_client_amount)}
                    </Text>
                  </View>
                )}
                {alerts.payment_due_soon && (
                  <View style={styles.alertItem}>
                    <Ionicons name="time" size={20} color={Colors.warning} />
                    <Text style={[styles.alertText, { color: Colors.warning }]}>
                      Payment due soon
                    </Text>
                  </View>
                )}
                {alerts.low_credit && (
                  <View style={styles.alertItem}>
                    <Ionicons name="information-circle" size={20} color={Colors.primary} />
                    <Text style={[styles.alertText, { color: Colors.primary }]}>
                      Low credit balance
                    </Text>
                  </View>
                )}
              </Card>
            )}

            {/* Recent Invoices */}
            <Card title="Recent Invoices" subtitle="Last 6 invoices">
              {invoices.recent_invoices.map(renderInvoiceItem)}
            </Card>
          </>
        )}

        {selectedTab === 'invoices' && (
          <>
            {/* Unpaid Invoices */}
            {invoices.unpaid_invoices.length > 0 && (
              <Card title="Unpaid Invoices" variant="highlight">
                {invoices.unpaid_invoices.map(renderInvoiceItem)}
              </Card>
            )}

            {/* Latest Invoices */}
            <Card title="Latest Invoices" subtitle="Last 6 invoices">
              {invoices.all_invoices.map(renderInvoiceItem)}
            </Card>
          </>
        )}

        {selectedTab === 'history' && (
          <>
            {/* Payment Summary */}
            <Card title="Payment Summary">
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Paid This Year</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(payment_history.total_paid_this_year)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Average Monthly</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(payment_history.average_monthly_amount)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Monthly Breakdown */}
            <Card title="Monthly Breakdown" subtitle="Last 12 months">
              <View style={styles.monthlyBreakdown}>
                {payment_history.monthly_breakdown.slice(-12).map((month) => (
                  <View key={month.month} style={styles.monthItem}>
                    <Text style={styles.monthName}>{month.month_name}</Text>
                    <View style={styles.monthDetails}>
                      <Text style={styles.monthAmount}>{formatCurrency(month.total_amount)}</Text>
                      <Text style={styles.monthCount}>{month.invoice_count} invoice(s)</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      {/* Payment WebView Modal */}
      <PaymentWebView
        visible={showPaymentWebView}
        paymentUrl={currentPaymentData?.payfast_url || ''}
        formData={currentPaymentData?.form_data || {}}
        onSuccess={handlePaymentSuccess}
        onCancel={handlePaymentCancel}
        onError={handlePaymentError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...CommonStyles.safeArea,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  comingSoon: {
    fontSize: Typography.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    marginBottom: Spacing.md,
  },
  summaryLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: Typography.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textInverse,
    letterSpacing: Typography.letterSpacing.wider,
  },
  billingInfo: {
    marginTop: Spacing.sm,
  },
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  billingLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  billingValue: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  billingValueContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  emailCount: {
    fontSize: Typography.xs,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
    marginTop: 2,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  alertText: {
    fontSize: Typography.sm,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  invoiceItem: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  invoiceNumber: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  invoiceDetails: {
    marginTop: Spacing.sm,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  invoiceLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  invoiceValue: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.text,
  },
  monthlyBreakdown: {
    marginTop: Spacing.sm,
  },
  monthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  monthName: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: Typography.weights.medium,
  },
  monthDetails: {
    alignItems: 'flex-end',
  },
  monthAmount: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  monthCount: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  // Payment styles
  paymentSection: {
    gap: Spacing.md,
  },
  paymentText: {
    fontSize: Typography.md,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    gap: Spacing.sm,
  },
  paymentButtonDisabled: {
    opacity: 0.6,
  },
  paymentButtonText: {
    color: 'white',
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
  },
  customAmountSection: {
    gap: Spacing.sm,
  },
  customAmountLabel: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: Typography.weights.medium,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.md,
    color: Colors.text,
    backgroundColor: Colors.card,
  },
  paymentNote: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  amountInputContainer: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: Typography.weights.medium,
  },
});
