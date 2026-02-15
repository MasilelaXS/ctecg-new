import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/Card';
import UncappedUsageCard from '../components/UncappedUsageCard';
import CustomButton from '../components/CustomButton';
import LoadingSpinner from '../components/LoadingSpinner';
import TopNavigation from '../components/TopNavigation';
import OnlineStatusIndicator from '../components/OnlineStatusIndicator';
import AdBanner from '../components/AdBanner';
import AdModal from '../components/AdModal';
import OutageBanner from '../components/OutageBanner';
import { showToast } from '../components/Toast';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { apiService } from '../services/api';
import { DashboardData } from '../types/api';
import { Colors, Typography, Spacing, CommonStyles } from '../constants/Design';

const { width } = Dimensions.get('window');

const cleanSubscriptionName = (name: string): string => {
  if (!name) return name;
  
  // Remove "Monthly Subscription (" prefix and trailing ")"
  const match = name.match(/Monthly Subscription \((.*)\)/i);
  if (match && match[1]) {
    return match[1];
  }
  
  return name;
};

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [outageNotifications, setOutageNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      console.log('User authenticated, loading dashboard for:', user.invoicingid);
      // Clear previous data when user changes (e.g., account switch)
      setDashboardData(null);
      setOutageNotifications([]);
      loadDashboardData();
      loadOutageNotifications();
      const intervalId = setInterval(() => {
        loadOutageNotifications();
      }, 30000);

      return () => clearInterval(intervalId);
    } else {
      console.log('No user found, waiting for authentication');
    }
  }, [user]);

  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      console.log('🔄 loadDashboardData called:', {
        isRefresh,
        currentUser: user?.invoicingid,
        userId: user?.id,
        timestamp: new Date().toISOString()
      });
      
      const response = await apiService.getDashboardData();
      
      console.log('📊 Dashboard API response received:', {
        success: response.success,
        customerName: response.data?.customer?.name,
        customerNumber: response.data?.customer?.customer_number,
        expectedUser: user?.invoicingid,
        timestamp: new Date().toISOString()
      });
      
      if (response.success && response.data) {
        setDashboardData(response.data as any);  // Temporary cast to bypass TypeScript error
      } else {
        console.error('Dashboard API error:', response.message);
        showToast.error('Error', response.message || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
      showToast.error('Error', 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadOutageNotifications = async () => {
    try {
      const response = await apiService.getOutageNotifications();
      if (response.success && response.data?.notifications) {
        setOutageNotifications(response.data.notifications);
      }
    } catch (error) {
      console.error('Failed to load outage notifications:', error);
    }
  };

  const handleDismissOutage = async (notificationId: number) => {
    try {
      await apiService.dismissNotification(notificationId);
      setOutageNotifications(prev => prev.filter(n => (n.notification_id ?? n.ticket_id) !== notificationId));
      showToast.success('Dismissed', 'Outage notification dismissed');
    } catch (error) {
      showToast.error('Error', 'Failed to dismiss notification');
    }
  };

  const handleViewOutageDetails = (notification: any) => {
    navigation.navigate('OutageDetails', { notification });
  };

  const onRefresh = () => {
    loadDashboardData(true);
    loadOutageNotifications();
  };

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBankingModal, setShowBankingModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const getUsagePercentage = () => {
    // Return null during loading or if data is not available
    if (!dashboardData?.usage?.current_month || !dashboardData?.usage?.package_details) {
      console.log('No dashboard data available');
      return null;
    }
    
    const { total_gb } = dashboardData.usage.current_month;
    const packageDetails = dashboardData.usage.package_details;
    
    console.log('Usage calculation data:', {
      total_gb,
      limit_gb: packageDetails.limit_gb,
      is_uncapped: packageDetails.is_uncapped,
      subscription_limit: packageDetails.subscription_limit
    });
    
    // For uncapped plans, return null to indicate percentage cannot be calculated
    if (packageDetails.is_uncapped) {
      console.log('Plan is uncapped, returning null');
      return null;
    }
    
    // Use the actual limit if available
    const limit = packageDetails.limit_gb;
    console.log('Checking limit:', limit, 'limit > 0:', limit > 0);
    
    if (limit && limit > 0) {
      const percentage = Math.min((total_gb / limit) * 100, 100);
      console.log('Calculated percentage:', percentage, `(${total_gb} / ${limit} * 100)`);
      return percentage;
    }
    
    console.log('No valid limit found, returning null');
    // If no proper limit is available, return null
    return null;
  };

  const getUsageColor = () => {
    const percentage = getUsagePercentage();
    
    // For uncapped plans or when percentage cannot be calculated
    if (percentage === null) {
      return Colors.primary;
    }
    
    // More aggressive color thresholds for better visibility
    if (percentage >= 95) return '#DC2626'; // Bright red for critical usage
    if (percentage >= 85) return '#EA580C'; // Orange-red for high usage
    if (percentage >= 70) return '#D97706'; // Orange for moderate-high usage
    if (percentage >= 50) return '#CA8A04'; // Yellow-orange for medium usage
    if (percentage >= 25) return '#16A34A'; // Green for low usage
    return '#059669'; // Dark green for very low usage
  };

  const getUsageTextColor = () => {
    const percentage = getUsagePercentage();
    
    // For uncapped plans or when percentage cannot be calculated
    if (percentage === null) {
      return Colors.text;
    }
    
    // Use white text for better contrast on darker/stronger colors
    if (percentage >= 50) return '#FFFFFF';
    return Colors.text;
  };

  const getStatusBadgeColor = () => {
    const accountType = dashboardData?.customer.account_type?.toLowerCase();
    const status = dashboardData?.customer.status?.toLowerCase();
    
    // Check account type first (Current/Post)
    if (accountType === 'current') {
      return Colors.success; // Green for Current accounts
    }
    if (accountType === 'post') {
      return Colors.error; // Red for Post (suspended) accounts
    }
    
    // Fallback to status check
    switch (status) {
      case 'active':
      case 'current':
        return Colors.success;
      case 'inactive':
      case 'suspended':
      case 'disconnected':
        return Colors.error;
      case 'pending':
      case 'partial':
        return Colors.warning;
      default:
        return Colors.textSecondary;
    }
  };

  // Quick Action Handlers
  const handleViewUsage = () => {
    navigation.navigate('Usage' as never);
  };

  const handlePayBill = () => {
    setShowPaymentModal(true);
  };

  const handleEFTPayment = () => {
    setShowPaymentModal(false);
    setShowBankingModal(true);
  };

  const handlePayInApp = () => {
    setShowPaymentModal(false);
    navigation.navigate('MakePayment' as never);
  };

  const handleSupport = () => {
    navigation.navigate('Support' as never);
  };

  const handleInvoices = () => {
    navigation.navigate('Billing' as never);
  };

  // Helper function to get first word from name
  const getFirstName = () => {
    if (dashboardData?.customer.name) {
      return dashboardData.customer.name.split(' ')[0];
    }
    return user?.invoicingid || 'Guest';
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading your dashboard..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <TopNavigation
        title="Dashboard"
        subtitle={`Welcome, ${getFirstName()}`}
      />

      {/* Modal Ad - shows once per 24 hours */}
      <AdModal />

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
        {/* Top Banner - Show Outage Banner if active outages exist, otherwise show Ad Banner */}
        {outageNotifications.length > 0 ? (
          <OutageBanner
            notification={outageNotifications[0]}
            onPress={() => handleViewOutageDetails(outageNotifications[0])}
            onDismiss={() => handleDismissOutage(outageNotifications[0].notification_id ?? outageNotifications[0].ticket_id)}
            style={{ marginBottom: Spacing.md }}
          />
        ) : (
          <AdBanner placement="dashboard_top" style={{ marginBottom: Spacing.md }} />
        )}

        {/* Account Summary */}
        <Card variant="highlight" style={styles.accountCard}>
          <View style={styles.accountHeader}>
            <View style={styles.accountInfoContainer}>
              <Text style={styles.accountNumber} numberOfLines={1}>
                {dashboardData?.customer.customer_number || 'Loading...'}
              </Text>
              <Text style={styles.accountName} numberOfLines={1} ellipsizeMode="tail">
                {dashboardData?.customer.name || user?.invoicingid || 'Account'}
              </Text>
              <View style={styles.onlineStatusContainer}>
                <OnlineStatusIndicator size="small" showText={true} autoRefresh={true} />
              </View>
            </View>
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusBadgeColor() }]}>
                <Text style={styles.statusText} numberOfLines={1}>
                  {dashboardData?.customer.account_type?.toUpperCase() || dashboardData?.customer.status?.toUpperCase() || 'ACTIVE'}
                </Text>
              </View>
              {dashboardData?.customer.status_reason && (
                <Text style={styles.statusReason} numberOfLines={2} ellipsizeMode="tail">
                  {dashboardData.customer.status_reason}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.packageInfo}>
            {dashboardData?.customer_info?.packages && dashboardData.customer_info.packages.length > 0 ? (
              <>
                <Text style={styles.packageSectionTitle}>Active Subscriptions</Text>
                {dashboardData.customer_info.packages.map((pkg, index) => (
                  <View key={pkg.id} style={styles.packageItem}>
                    <View style={styles.packageItemHeader}>
                      <Text style={styles.packageItemName} numberOfLines={2} ellipsizeMode="tail">
                        {pkg.name}
                      </Text>
                      <Text style={styles.packageItemAmount}>
                        R{pkg.amount.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))}
                <View style={styles.packageTotalContainer}>
                  <Text style={styles.packageTotalLabel}>Total Monthly:</Text>
                  <Text style={styles.packageTotalAmount}>
                    R{dashboardData.customer_info.total_subscription_amount?.toFixed(2) || '0.00'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.packageName} numberOfLines={2} ellipsizeMode="tail">
                  {cleanSubscriptionName(dashboardData?.usage.package_details.name || '') || 'Loading...'}
                </Text>
                <Text style={styles.packageSpeed} numberOfLines={1}>
                  {apiService.formatSpeedForDisplay(dashboardData?.usage.package_details) || 'Loading...'}
                </Text>
                <Text style={styles.packageLimit} numberOfLines={1}>
                  Limit: {apiService.formatSubscriptionLimit(dashboardData?.usage.package_details)}
                </Text>
              </>
            )}
          </View>
        </Card>

        {/* Usage Summary */}
        {dashboardData?.usage.package_details.is_uncapped ? (
          <UncappedUsageCard
            downloadGb={dashboardData.usage.current_month.download_gb}
            uploadGb={dashboardData.usage.current_month.upload_gb}
            totalGb={dashboardData.usage.current_month.total_gb}
            packageName={cleanSubscriptionName(dashboardData.usage.package_details.name) || 'Unlimited Plan'}
          />
        ) : (
          <Card title="Data Usage" subtitle="Current Month">
            <View style={styles.usageContainer}>
              <View style={styles.usageChart}>
                <View style={styles.usageCircle}>
                  <View 
                    style={[
                      styles.usageProgress,
                      {
                        backgroundColor: getUsageColor(),
                        height: getUsagePercentage() !== null ? `${getUsagePercentage()!}%` : '0%',
                      }
                    ]} 
                  />
                  <View style={styles.usageContent}>
                    <Text style={[styles.usagePercentage, { color: getUsageTextColor() }]}>
                      {!dashboardData ? 'Loading...' : getUsagePercentage() !== null ? `${Math.round(getUsagePercentage()!)}%` : 'N/A'}
                    </Text>
                    <Text style={[styles.usageLabel, { color: getUsageTextColor() }]}>
                      {!dashboardData ? '' : getUsagePercentage() !== null ? 'Used' : 'Uncapped'}
                    </Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.usageDetails}>
                <View style={styles.usageRow}>
                  <Text style={styles.usageDetailLabel}>Downloaded</Text>
                  <Text style={styles.usageDetailValue}>
                    {dashboardData?.usage.current_month.download_gb.toFixed(1) || '0'} GB
                  </Text>
                </View>
                <View style={styles.usageRow}>
                  <Text style={styles.usageDetailLabel}>Uploaded</Text>
                  <Text style={styles.usageDetailValue}>
                    {dashboardData?.usage.current_month.upload_gb.toFixed(1) || '0'} GB
                  </Text>
                </View>
                <View style={styles.usageRow}>
                  <Text style={styles.usageDetailLabel}>Total Used</Text>
                  <Text style={[styles.usageDetailValue, styles.usageTotalValue]}>
                    {dashboardData?.usage.current_month.total_gb.toFixed(1) || '0'} GB
                  </Text>
                </View>
                <View style={styles.usageRow}>
                  <Text style={styles.usageDetailLabel}>Package Limit</Text>
                  <Text style={styles.usageDetailValue}>
                    {dashboardData?.usage.package_details.subscription_limit || 'N/A'}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Quick Actions */}
        <Card title="Quick Actions">
          <View style={styles.quickActions}>
            <CustomButton
              title="View Usage"
              onPress={handleViewUsage}
              variant="outline"
              size="medium"
              style={styles.actionButton}
            />
            <CustomButton
              title="Pay Bill"
              onPress={handlePayBill}
              variant="primary"
              size="medium"
              style={styles.actionButton}
            />
          </View>
          <View style={styles.quickActions}>
            <CustomButton
              title="Support"
              onPress={handleSupport}
              variant="secondary"
              size="medium"
              style={styles.actionButton}
            />
            <CustomButton
              title="Invoices"
              onPress={handleInvoices}
              variant="secondary"
              size="medium"
              style={styles.actionButton}
            />
          </View>
        </Card>

        {/* Alerts & Notifications */}
        {(dashboardData?.current_outages?.length || 0) > 0 && (
          <Card title="Service Alerts" variant="highlight">
            {dashboardData?.current_outages.map((outage) => (
              <View key={outage.id} style={styles.alertItem}>
                <Ionicons name="warning" size={20} color={Colors.warning} />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle} numberOfLines={2} ellipsizeMode="tail">  {outage.title}</Text>
                  <Text style={styles.alertDescription} numberOfLines={3} ellipsizeMode="tail">{outage.description}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Recent Invoices */}
        {(dashboardData?.recent_payments?.length || 0) > 0 && (
          <Card title="Recent Invoices">
            {dashboardData?.recent_payments.slice(0, 3).map((invoice: any) => (
              <View key={invoice.invoice_number} style={styles.invoiceItem}>
                <View style={styles.invoiceHeader}>
                  <Text style={styles.invoiceNumber}>#{invoice.invoice_number}</Text>
                  <Text style={[styles.invoiceStatus, { 
                    color: invoice.status === 'paid' ? Colors.success : Colors.warning 
                  }]}>
                    {invoice.status.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.invoiceDetails}>
                  <Text style={styles.invoiceAmount}>R{invoice.amount}</Text>
                  <Text style={styles.invoiceDate}>{invoice.date}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Support Tickets */}
        {(dashboardData?.active_tickets?.length || 0) > 0 && (
          <Card title="Recent Support Tickets">
            {dashboardData?.active_tickets.map((ticket: any) => (
              <View key={ticket.id} style={styles.ticketItem}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketTitle} numberOfLines={2} ellipsizeMode="tail">{ticket.title}</Text>
                  <Text style={[styles.ticketStatus, { color: getStatusColor(ticket.status) }]} numberOfLines={1}>
                    {ticket.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.ticketCategory} numberOfLines={1}>
                  {ticket.type?.toUpperCase() || 'SUPPORT'} • Priority: {ticket.priority || 'N/A'}
                </Text>
                <Text style={styles.ticketDate} numberOfLines={1}>
                  Reported: {ticket.date_reported || 'N/A'}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Bottom Ad Banner */}
        <AdBanner placement="dashboard_bottom" style={{ marginTop: Spacing.md }} />
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        visible={showLogoutModal}
        type="warning"
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Cancel"
        onConfirm={() => {
          setShowLogoutModal(false);
          logout();
        }}
        onCancel={() => setShowLogoutModal(false)}
        destructive
      />

      {/* Payment Options Modal */}
      <ConfirmationModal
        visible={showPaymentModal}
        type="info"
        title="Payment Options"
        message="Pay in App - Fast & secure card payment via Yoco\n\nEFT Transfer - Transfer using online banking"
        confirmText="Pay in App"
        cancelText="EFT Transfer"
        onConfirm={handlePayInApp}
        onCancel={() => {
          setShowPaymentModal(false);
          handleEFTPayment();
        }}
      />

      {/* Banking Details Modal */}
      <ConfirmationModal
        visible={showBankingModal}
        type="info"
        title="EFT Payment Details"
        message={`Bank: FNB\nAccount Name: CTECG\nAccount Number: 123456789\nBranch Code: 250655\n\nReference: ${dashboardData?.customer.customer_number || 'Your account number'}\n\nPlease use your account number as the payment reference.`}
        confirmText="OK"
        onConfirm={() => setShowBankingModal(false)}
        onCancel={() => setShowBankingModal(false)}
        showCancel={false}
      />
    </SafeAreaView>
  );
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'open':
    case 'new':
      return Colors.primary;
    case 'in_progress':
    case 'assigned':
      return Colors.warning;
    case 'resolved':
    case 'closed':
      return Colors.success;
    default:
      return Colors.textSecondary;
  }
};

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
  accountCard: {
    marginBottom: Spacing.md,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  accountInfoContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  accountNumber: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  accountName: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
  },
  onlineStatusContainer: {
    marginTop: Spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  statusText: {
    fontSize: Typography.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textInverse,
    letterSpacing: Typography.letterSpacing.wider,
  },
  statusReason: {
    fontSize: Typography.xs,
    color: Colors.error,
    marginTop: Spacing.xs,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  packageInfo: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  packageName: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  packageSpeed: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  packageLimit: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
    marginTop: Spacing.xs,
  },
  packageSectionTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  packageItem: {
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  packageItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageItemName: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.text,
    marginRight: Spacing.sm,
  },
  packageItemAmount: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.primary,
  },
  packageTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  packageTotalLabel: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  packageTotalAmount: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  usageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usageChart: {
    width: 120,
    height: 120,
    marginRight: Spacing.lg,
  },
  usageCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  usageProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 60,
  },
  usageContent: {
    alignItems: 'center',
  },
  usagePercentage: {
    fontSize: Typography.xl,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.xs,
  },
  usageLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wider,
  },
  usageDetails: {
    flex: 1,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  usageDetailLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  usageDetailValue: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  usageTotalValue: {
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  alertContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  alertTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  alertDescription: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sm * Typography.lineHeights.relaxed,
  },
  ticketItem: {
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  ticketTitle: {
    flex: 1,
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginRight: Spacing.sm,
  },
  ticketStatus: {
    fontSize: Typography.xs,
    fontWeight: Typography.weights.bold,
    letterSpacing: Typography.letterSpacing.wider,
  },
  ticketCategory: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    letterSpacing: Typography.letterSpacing.wider,
  },
  ticketDate: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  invoiceItem: {
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  invoiceNumber: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  invoiceStatus: {
    fontSize: Typography.xs,
    fontWeight: Typography.weights.bold,
    letterSpacing: Typography.letterSpacing.wider,
  },
  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceAmount: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  invoiceDate: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
});
