import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import TopNavigation from '../components/TopNavigation';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import AdBanner from '../components/AdBanner';
import { showToast } from '../components/Toast';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { DetailedBillingData, BillingInvoice } from '../types/api';
import { Colors, Typography, Spacing, CommonStyles } from '../constants/Design';

export default function BillingScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [billingData, setBillingData] = useState<DetailedBillingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'invoices' | 'history'>('overview');
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  
  // Payment state
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [currentPaymentData, setCurrentPaymentData] = useState<any>(null);
  const [showPaymentWebView, setShowPaymentWebView] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  
  // Modal states
  const [showEmailSelectionModal, setShowEmailSelectionModal] = useState(false);
  const [emailSelectionData, setEmailSelectionData] = useState<{emails: string[], amount: number} | null>(null);

  useEffect(() => {
    if (user) {
      console.log('User changed, clearing billing data and reloading for:', user.invoicingid);
      setBillingData(null);
      setPaymentInfo(null);
      loadBillingData();
    }
  }, [user]);

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
        showToast.error('Error', response.message || 'Failed to load billing data');
      }
    } catch (error) {
      console.error('Billing load error:', error);
      showToast.error('Error', 'Failed to load billing data');
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
        showToast.warning('Service Unavailable', 'Unable to load billing information. Please try again.');
        await loadBillingData(true);
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
          showToast.error('Invalid Amount', 'Please enter a valid amount (minimum R5.00)');
          return;
        }
      }

      // If still no amount specified, show error
      if (!amount) {
        showToast.error('Amount Required', 'Please enter a payment amount');
        return;
      }

      console.log('📊 Processing payment for amount:', amount);

      // Check if multiple emails are available for selection
      if (!billingData) {
        showToast.error('Error', 'Billing data not available');
        return;
      }

      const billingEmail = billingData.billing_info.billing_email;
      
      // Handle different email scenarios based on new format
      if (billingEmail.has_email && billingEmail.email_count === 1) {
        // Single email - use it directly
        await processPayment(amount, billingEmail.primary_email!);
      } else if (billingEmail.has_email && billingEmail.email_count > 1) {
        // Multiple emails - show selection modal
        setEmailSelectionData({ emails: billingEmail.all_emails, amount: amount! });
        setShowEmailSelectionModal(true);
      } else {
        // No email on file - require user input
        showEmailInputDialog(amount);
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      showToast.error('Error', 'Failed to initiate payment process');
    }
  };

  const showAmountInputDialog = () => {
    // Navigate to MakePayment screen which has proper input UI
    navigation.navigate('MakePayment');
  };

  const showEmailInputDialog = (amount: number) => {
    // For now, show error - in production, would show a proper input modal
    showToast.warning('Email Required', 'Please update your billing email in your account settings');
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
        showToast.error(
          'Payment Setup Error',
          errorMessage.includes('network') ? 
            'Unable to connect to payment server. Please check your internet connection.' :
            errorMessage
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
      
      showToast.error('Connection Error', errorMessage);
    } finally {
      // Always reset loading state
      setIsPaymentLoading(false);
    }
  };

  const [paymentSuccessData, setPaymentSuccessData] = useState<{id: string, amount: string} | null>(null);
  const [showPaymentSuccessModal, setShowPaymentSuccessModal] = useState(false);
  const [showPaymentCancelledModal, setShowPaymentCancelledModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const handlePaymentSuccess = async (paymentId: string) => {
    setIsPaymentLoading(false);
    setShowPaymentWebView(false);
    setCustomAmount(''); // Clear the custom amount input
    
    // Get payment amount for display
    const paymentAmount = currentPaymentData?.amount || 'your payment';
    setPaymentSuccessData({ 
      id: paymentId, 
      amount: typeof paymentAmount === 'number' ? paymentAmount.toFixed(2) : String(paymentAmount) 
    });
    setCurrentPaymentData(null);
    setShowPaymentSuccessModal(true);
  };

  const handlePaymentCancel = () => {
    setIsPaymentLoading(false);
    setShowPaymentWebView(false);
    setCurrentPaymentData(null);
    setShowPaymentCancelledModal(true);
  };

  const handlePaymentError = (error: string) => {
    setIsPaymentLoading(false);
    setShowPaymentWebView(false);
    setCurrentPaymentData(null);
    
    // Provide user-friendly error messages and actions
    let title = 'Payment Error';
    let message = error || 'There was an error processing your payment. Please try again.';
    
    // Customize message and actions based on error type
    if (error.includes('network') || error.includes('connection')) {
      title = 'Connection Error';
      message = 'Unable to connect to the payment server. Please check your internet connection and try again.';
    } else if (error.includes('timeout')) {
      title = 'Payment Timeout';
      message = 'The payment request timed out. Your payment may still be processing. Please check your account in a few minutes.';
    } else if (error.includes('declined')) {
      title = 'Payment Declined';
      message = 'Your payment was declined by your bank or card issuer. Please check your payment details or try a different payment method.';
    } else if (error.includes('insufficient')) {
      title = 'Insufficient Funds';
      message = 'Your payment was declined due to insufficient funds. Please check your account balance or try a different payment method.';
    }
    
    showToast.error(title, message);
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
      return 'Credit Balance'; // Negative = Client has credit (prepaid/overpaid)
    } else if (balance > 0) {
      return 'Amount Due'; // Positive = Client owes money
    } else {
      return 'Current Balance'; // Zero = Account is current
    }
  };

  const getBalanceColor = (balance: number) => {
    if (balance < 0) {
      return Colors.success; // Client has credit
    } else if (balance > 0) {
      return Colors.warning; // Client owes money (debt)
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

      {/* Ad Banner */}
      <AdBanner placement="billing" style={{ marginHorizontal: Spacing.md, marginTop: Spacing.sm }} />

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
                {account_summary.current_balance > 0 && account_summary.client_owes_amount > 0 && 
                 account_summary.client_owes_amount !== Math.abs(account_summary.current_balance) && (
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Amount Due</Text>
                    <Text style={[styles.summaryValue, { color: Colors.warning }]}>
                      {formatCurrency(account_summary.client_owes_amount)}
                    </Text>
                  </View>
                )}
                {/* Only show credit info if account actually has credit (negative balance) */}
                {account_summary.current_balance < 0 && (
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

            {/* Make Payment Button */}
            <TouchableOpacity 
              style={styles.makePaymentButton}
              onPress={() => navigation.navigate('MakePayment')}
            >
              <Ionicons name="card-outline" size={24} color="#FFFFFF" />
              <Text style={styles.makePaymentButtonText}>Make a Payment</Text>
              <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
            </TouchableOpacity>

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
                        showToast.info('All Billing Emails', billing_info.billing_email.all_emails.join(', '));
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

            {/* Debit Order Application */}
            <TouchableOpacity 
              style={styles.debitOrderButton}
              onPress={() => navigation.navigate('DebitOrder')}
              activeOpacity={0.7}
            >
              <View style={styles.debitOrderContent}>
                <View style={styles.debitOrderLeft}>
                  <Ionicons name="repeat-outline" size={28} color={Colors.primary} />
                  <View style={styles.debitOrderTextContainer}>
                    <Text style={styles.debitOrderTitle}>Apply for Debit Order</Text>
                    <Text style={styles.debitOrderSubtitle}>Set up automated monthly payments</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
              </View>
            </TouchableOpacity>

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

            {/* Company Banking Details */}
            <TouchableOpacity 
              style={styles.companyInfoButton}
              onPress={() => setShowCompanyInfo(true)}
            >
              <Ionicons name="business-outline" size={20} color={Colors.primary} />
              <Text style={styles.companyInfoButtonText}>View Company Banking Details</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Company Info Modal */}
      <Modal
        visible={showCompanyInfo}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCompanyInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Company Information</Text>
              <TouchableOpacity onPress={() => setShowCompanyInfo(false)}>
                <Ionicons name="close-circle" size={28} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              {/* Company Details */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Company Details</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Official Name</Text>
                  <Text style={styles.infoValue}>Mzanzi Lisette Media and Printing</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Trading As</Text>
                  <Text style={styles.infoValue}>CTECG</Text>
                </View>
              </View>

              {/* Address */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Physical Address</Text>
                <Text style={styles.addressText}>
                  Rusma Building, Shop 6{"\n"}
                  1 Hamman Street{"\n"}
                  Groblersdal, 0470{"\n"}
                  Limpopo, South Africa
                </Text>
              </View>

              {/* Contact */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Contact Details</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="call" size={16} color={Colors.primary} />
                  <Text style={styles.infoLabel}>Customer Care</Text>
                  <Text style={styles.infoValue}>076 979 0642</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="call" size={16} color={Colors.primary} />
                  <Text style={styles.infoLabel}>Landline</Text>
                  <Text style={styles.infoValue}>013 262 4798</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="mail" size={16} color={Colors.primary} />
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>helpdesk@ctecg.co.za</Text>
                </View>
              </View>

              {/* Banking Details */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Banking Details</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Account Holder</Text>
                  <Text style={styles.infoValue}>Mzanzi Lisette Media and Printing</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Bank Name</Text>
                  <Text style={styles.infoValue}>FNB</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Account Type</Text>
                  <Text style={styles.infoValue}>Cheque</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Account Number</Text>
                  <Text style={[styles.infoValue, styles.accountNumber]}>621 441 98737</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Branch</Text>
                  <Text style={styles.infoValue}>Groblersdal</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Branch Code</Text>
                  <Text style={styles.infoValue}>260147</Text>
                </View>
              </View>

              <View style={styles.modalNote}>
                <Ionicons name="information-circle" size={16} color={Colors.info} />
                <Text style={styles.noteText}>
                  Please use your invoicing ID as reference when making payments.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Success Modal */}
      <ConfirmationModal
        visible={showPaymentSuccessModal}
        type="success"
        title="Payment Successful! 🎉"
        message={`Your payment of R${paymentSuccessData?.amount || '0'} has been processed successfully.\n\nPayment ID: ${paymentSuccessData?.id || ''}\n\nYour account will be updated within a few minutes.`}
        confirmText="Done"
        cancelText="View Receipt"
        onConfirm={() => {
          setShowPaymentSuccessModal(false);
          setPaymentSuccessData(null);
          loadBillingData(true);
          loadPaymentInfo();
        }}
        onCancel={() => {
          setShowReceiptModal(true);
        }}
      />

      {/* Receipt Modal */}
      <ConfirmationModal
        visible={showReceiptModal}
        type="info"
        title="Receipt"
        message={`Payment ID: ${paymentSuccessData?.id || ''}\nAmount: R${paymentSuccessData?.amount || '0'}\nStatus: Successful\nProcessed by: PayFast`}
        confirmText="Done"
        onConfirm={() => {
          setShowReceiptModal(false);
          setShowPaymentSuccessModal(false);
          setPaymentSuccessData(null);
          loadBillingData(true);
          loadPaymentInfo();
        }}
        onCancel={() => setShowReceiptModal(false)}
        showCancel={false}
      />

      {/* Payment Cancelled Modal */}
      <ConfirmationModal
        visible={showPaymentCancelledModal}
        type="info"
        title="Payment Cancelled"
        message="Your payment was cancelled. No charges were made to your account."
        confirmText="OK"
        onConfirm={() => setShowPaymentCancelledModal(false)}
        onCancel={() => setShowPaymentCancelledModal(false)}
        showCancel={false}
      />

      {/* Email Selection Modal */}
      {showEmailSelectionModal && emailSelectionData && (
        <Modal
          visible={showEmailSelectionModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEmailSelectionModal(false)}
        >
          <View style={styles.emailModalOverlay}>
            <View style={styles.emailModalContainer}>
              <Text style={styles.emailModalTitle}>Select Email Address</Text>
              <Text style={styles.emailModalSubtitle}>Choose which email to use for payment confirmation:</Text>
              {emailSelectionData.emails.map((email, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.emailOption}
                  onPress={() => {
                    setShowEmailSelectionModal(false);
                    processPayment(emailSelectionData.amount, email);
                  }}
                >
                  <Ionicons name="mail-outline" size={20} color={Colors.primary} />
                  <Text style={styles.emailOptionText}>{email}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.emailCancelButton}
                onPress={() => setShowEmailSelectionModal(false)}
              >
                <Text style={styles.emailCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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
  makePaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    gap: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  makePaymentButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: Typography.weights.bold,
    flex: 1,
    textAlign: 'center',
  },
  companyInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    marginBottom: Spacing.xl,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  companyInfoButtonText: {
    color: Colors.primary,
    fontSize: Typography.sm,
    fontWeight: Typography.weights.medium,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  modalScroll: {
    padding: Spacing.lg,
  },
  infoSection: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.card,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  infoLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: Typography.weights.medium,
    flex: 1,
    textAlign: 'right',
  },
  addressText: {
    fontSize: Typography.sm,
    color: Colors.text,
    lineHeight: 22,
  },
  accountNumber: {
    fontFamily: 'monospace',
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  modalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: Colors.backgroundAlt,
    padding: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.md,
  },
  noteText: {
    flex: 1,
    fontSize: Typography.xs,
    color: Colors.info,
    lineHeight: 18,
  },
  emailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  emailModalContainer: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 340,
  },
  emailModalTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  emailModalSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  emailOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 8,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  emailOptionText: {
    fontSize: Typography.md,
    color: Colors.text,
    flex: 1,
  },
  emailCancelButton: {
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  emailCancelText: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  debitOrderButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  debitOrderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  debitOrderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  debitOrderTextContainer: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  debitOrderTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: 2,
  },
  debitOrderSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
});
