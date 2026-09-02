import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/Card";
import DataUsageGauge, {
  getUsageColor,
  USAGE_RING_COLORS,
} from "../components/DataUsageGauge";
import UncappedUsageCard from "../components/UncappedUsageCard";
import CustomButton from "../components/CustomButton";
import LoadingSpinner from "../components/LoadingSpinner";
import TopNavigation from "../components/TopNavigation";
import OnlineStatusIndicator from "../components/OnlineStatusIndicator";
import AdBanner from "../components/AdBanner";
import AdModal from "../components/AdModal";
import OutageBanner from "../components/OutageBanner";
import TowerNotificationCard from "../components/TowerNotificationCard";
import CachedDataNotice from "../components/CachedDataNotice";
import { showToast } from "../components/Toast";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { apiService } from "../services/api";
import { DashboardData, TowerNotification } from "../types/api";
import { Colors, Typography, Spacing, CommonStyles } from "../constants/Design";
import { calculateUsageRingPercentages } from "../utils/usageRings";

const { width } = Dimensions.get("window");

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
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [outageNotifications, setOutageNotifications] = useState<any[]>([]);
  const [outagesEnabled, setOutagesEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [towerNotifications, setTowerNotifications] = useState<TowerNotification[]>([]);
  const accountRequestGeneration = useRef(0);

  useEffect(() => {
    const requestGeneration = ++accountRequestGeneration.current;
    if (user) {
      console.log(
        "User authenticated, loading dashboard for:",
        user.invoicingid,
      );
      // Clear previous data when user changes (e.g., account switch)
      setDashboardData(null);
      setCachedAt(null);
      setOutageNotifications([]);
      setTowerNotifications([]);
      void loadDashboardData(false, requestGeneration);
    } else {
      console.log("No user found, waiting for authentication");
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setOutagesEnabled(false);
      setNotificationsEnabled(false);
      setOutageNotifications([]);
      setTowerNotifications([]);
      return;
    }

    let active = true;
    let outageIntervalId: ReturnType<typeof setInterval> | null = null;
    let notificationIntervalId: ReturnType<typeof setInterval> | null = null;

    const configureOutages = async () => {
      try {
        const response = await apiService.getAppConfig();
        const enabled = response.success && response.data?.outages_enabled === true;
        const noticesEnabled = response.success && response.data?.notifications_enabled === true;
        if (!active) return;

        setOutagesEnabled(enabled);
        setNotificationsEnabled(noticesEnabled);
        if (enabled) {
          await loadOutageNotifications();
          if (active) outageIntervalId = setInterval(() => void loadOutageNotifications(), 30000);
        } else {
          setOutageNotifications([]);
        }
        if (noticesEnabled) {
          await loadTowerNotifications();
          if (active) notificationIntervalId = setInterval(() => void loadTowerNotifications(), 30000);
        } else {
          setTowerNotifications([]);
        }
      } catch (error) {
        if (active) {
          // Feature visibility is fail-closed when its authoritative setting
          // cannot be loaded. Normal dashboard content remains available.
          setOutagesEnabled(false);
          setNotificationsEnabled(false);
          setOutageNotifications([]);
          setTowerNotifications([]);
        }
        console.error("Failed to load outage feature setting:", error);
      }
    };

    void configureOutages();

    return () => {
      active = false;
      if (outageIntervalId) clearInterval(outageIntervalId);
      if (notificationIntervalId) clearInterval(notificationIntervalId);
    };
  }, [user]);

  const loadDashboardData = async (
    isRefresh = false,
    requestGeneration = accountRequestGeneration.current,
  ) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      console.log("🔄 loadDashboardData called:", {
        isRefresh,
        currentUser: user?.invoicingid,
        userId: user?.id,
        timestamp: new Date().toISOString(),
      });

      const response = await apiService.getDashboardData();
      if (requestGeneration !== accountRequestGeneration.current) return;

      console.log("📊 Dashboard API response received:", {
        success: response.success,
        customerName: response.data?.customer?.name,
        customerNumber: response.data?.customer?.customer_number,
        expectedUser: user?.invoicingid,
        timestamp: new Date().toISOString(),
      });

      if (response.success && response.data) {
        setDashboardData(response.data);
        setCachedAt(response.meta?.source === "cache" ? response.meta.cached_at || null : null);
      } else {
        console.error("Dashboard API error:", response.message);
        showToast.error(
          "Error",
          response.message || "Failed to load dashboard data",
        );
      }
    } catch (error) {
      if (requestGeneration !== accountRequestGeneration.current) return;
      console.error("Dashboard load error:", error);
      showToast.error("Error", "Failed to load dashboard data");
    } finally {
      if (requestGeneration === accountRequestGeneration.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  const loadOutageNotifications = async () => {
    try {
      const response = await apiService.getOutageNotifications();
      if (response.success && response.data?.notifications) {
        setOutageNotifications(response.data.notifications);
      }
    } catch (error) {
      console.error("Failed to load outage notifications:", error);
    }
  };

  const handleDismissOutage = async (notificationId: number) => {
    try {
      await apiService.dismissNotification(notificationId);
      setOutageNotifications((prev) =>
        prev.filter(
          (n) => (n.notification_id ?? n.ticket_id) !== notificationId,
        ),
      );
      showToast.success("Dismissed", "Outage notification dismissed");
    } catch (error) {
      showToast.error("Error", "Failed to dismiss notification");
    }
  };

  const handleViewOutageDetails = (notification: any) => {
    navigation.navigate("OutageDetails", { notification });
  };

  const onRefresh = () => {
    loadDashboardData(true);
    if (outagesEnabled) {
      loadOutageNotifications();
    }
    if (notificationsEnabled) {
      loadTowerNotifications();
    }
  };

  const loadTowerNotifications = async () => {
    try {
      const response = await apiService.getTowerNotifications();
      if (response.success && response.data?.notifications) {
        setTowerNotifications((current) => {
          const next = response.data!.notifications;
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
      }
    } catch (error) {
      // Keep existing notices visible if a background refresh temporarily fails.
      console.error("Failed to load tower notifications:", error);
    }
  };

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBankingModal, setShowBankingModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const getStatusBadgeColor = () => {
    const accountType = dashboardData?.customer.account_type?.toLowerCase();
    const status = dashboardData?.customer.status?.toLowerCase();

    // Check account type first (Current/Post)
    if (accountType === "current") {
      return Colors.success; // Green for Current accounts
    }
    if (accountType === "post") {
      return Colors.error; // Red for Post (suspended) accounts
    }

    // Fallback to status check
    switch (status) {
      case "active":
      case "current":
        return Colors.success;
      case "inactive":
      case "suspended":
      case "disconnected":
        return Colors.error;
      case "pending":
      case "partial":
        return Colors.warning;
      default:
        return Colors.textSecondary;
    }
  };

  // Quick Action Handlers
  const handleViewUsage = () => {
    navigation.navigate("Usage" as never);
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
    navigation.navigate("MakePayment" as never);
  };

  const handleSupport = () => {
    navigation.navigate("Support" as never);
  };

  const handleInvoices = () => {
    navigation.navigate("Billing" as never);
  };

  // Helper function to get first word from name
  const getFirstName = () => {
    if (dashboardData?.customer.name) {
      return dashboardData.customer.name.split(" ")[0];
    }
    return user?.invoicingid || "Guest";
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading your dashboard..." />;
  }

  const dashboardUsageRings = dashboardData
    ? calculateUsageRingPercentages(
        dashboardData.usage.current_month.download_gb,
        dashboardData.usage.current_month.upload_gb,
        dashboardData.usage.current_month.total_gb,
        dashboardData.usage.package_details.limit_gb,
        Boolean(dashboardData.usage.package_details.is_uncapped),
      )
    : null;

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
        <CachedDataNotice cachedAt={cachedAt} />
        {/* Top Banner - Show Outage Banner if active outages exist, otherwise show Ad Banner */}
        {outagesEnabled && outageNotifications.length > 0 ? (
          <OutageBanner
            notification={outageNotifications[0]}
            onPress={() => handleViewOutageDetails(outageNotifications[0])}
            onDismiss={() =>
              handleDismissOutage(
                outageNotifications[0].notification_id ??
                  outageNotifications[0].ticket_id,
              )
            }
            style={{ marginBottom: Spacing.md }}
          />
        ) : (
          <AdBanner
            placement="dashboard_top"
            style={{ marginBottom: Spacing.md }}
          />
        )}

        {notificationsEnabled && towerNotifications.map((notification) => (
          <TowerNotificationCard key={notification.ticket_id} notification={notification} />
        ))}

        {/* Account Summary */}
        <Card style={styles.accountCard}>
          <View style={styles.accountHeader}>
            <View style={styles.accountInfoContainer}>
              <Text style={styles.accountNumber} numberOfLines={1}>
                {dashboardData?.customer.customer_number || "Loading..."}
              </Text>
              <Text
                style={styles.accountName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {dashboardData?.customer.name || user?.invoicingid || "Account"}
              </Text>
              <View style={styles.onlineStatusContainer}>
                <OnlineStatusIndicator
                  size="small"
                  showText={true}
                  autoRefresh={true}
                />
              </View>
            </View>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusBadgeColor() },
                ]}
              >
                <Text style={styles.statusText} numberOfLines={1}>
                  {dashboardData?.customer.account_type?.toUpperCase() ||
                    dashboardData?.customer.status?.toUpperCase() ||
                    "ACTIVE"}
                </Text>
              </View>
              {dashboardData?.customer.status_reason && (
                <Text
                  style={styles.statusReason}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {dashboardData.customer.status_reason}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.packageInfo}>
            {dashboardData?.customer_info?.packages &&
            dashboardData.customer_info.packages.length > 0 ? (
              <>
                <Text style={styles.packageSectionTitle}>
                  Active Subscriptions
                </Text>
                {dashboardData.customer_info.packages.map((pkg, index) => (
                  <View
                    key={pkg.id}
                    style={[
                      styles.packageItem,
                      index > 0 && styles.packageItemSeparated,
                    ]}
                  >
                    <View style={styles.packageItemHeader}>
                      <Text
                        style={styles.packageItemName}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {pkg.name}
                      </Text>
                      <View style={styles.packageAmountContainer}>
                        <Text style={styles.packageItemAmount}>
                          R{pkg.amount.toFixed(2)}
                        </Text>
                        <Text style={styles.vatLabel}>incl. VAT</Text>
                      </View>
                    </View>
                  </View>
                ))}
                <View style={styles.packageTotalContainer}>
                  <Text style={styles.packageTotalLabel}>Total Monthly:</Text>
                  <Text style={styles.packageTotalAmount}>
                    R
                    {dashboardData.customer_info.total_subscription_amount?.toFixed(
                      2,
                    ) || "0.00"}
                  </Text>
                </View>
                <Text style={styles.packageTotalVatLabel}>
                  Total includes VAT
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={styles.packageName}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {cleanSubscriptionName(
                    dashboardData?.usage.package_details.name || "",
                  ) || "Loading..."}
                </Text>
                <Text style={styles.packageSpeed} numberOfLines={1}>
                  {apiService.formatSpeedForDisplay(
                    dashboardData?.usage.package_details,
                  ) || "Loading..."}
                </Text>
                <Text style={styles.packageLimit} numberOfLines={1}>
                  Limit:{" "}
                  {apiService.formatSubscriptionLimit(
                    dashboardData?.usage.package_details,
                  )}
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
            packageName={
              cleanSubscriptionName(dashboardData.usage.package_details.name) ||
              "Unlimited Plan"
            }
          />
        ) : (
          <Card title="Data Usage" subtitle="Current Month">
            <View style={styles.usageContainer}>
              <View style={styles.usageChart}>
                <DataUsageGauge
                  percentage={dashboardUsageRings?.total ?? null}
                  downloadPercentage={dashboardUsageRings?.download ?? 0}
                  uploadPercentage={dashboardUsageRings?.upload ?? 0}
                />
              </View>

              <View style={styles.usageDetails}>
                <View style={styles.usageRow}>
                  <View style={styles.metricLabelContainer}>
                    <View
                      style={[
                        styles.metricDot,
                        { backgroundColor: USAGE_RING_COLORS.download },
                      ]}
                    />
                    <Text style={styles.usageDetailLabel}>Downloaded</Text>
                  </View>
                  <View style={styles.metricValueContainer}>
                    <Text style={styles.usageDetailValue}>
                      {dashboardData?.usage.current_month.download_gb.toFixed(
                        1,
                      ) || "0"}{" "}
                      GB
                    </Text>
                    <Text style={styles.metricPercentage}>
                      {dashboardUsageRings?.total === null
                        ? "Percentage unavailable"
                        : `${Math.round(dashboardUsageRings?.download ?? 0)}% of limit`}
                    </Text>
                  </View>
                </View>
                <View style={styles.usageRow}>
                  <View style={styles.metricLabelContainer}>
                    <View
                      style={[
                        styles.metricDot,
                        { backgroundColor: USAGE_RING_COLORS.upload },
                      ]}
                    />
                    <Text style={styles.usageDetailLabel}>Uploaded</Text>
                  </View>
                  <View style={styles.metricValueContainer}>
                    <Text style={styles.usageDetailValue}>
                      {dashboardData?.usage.current_month.upload_gb.toFixed(1) ||
                        "0"}{" "}
                      GB
                    </Text>
                    <Text style={styles.metricPercentage}>
                      {dashboardUsageRings?.total === null
                        ? "Percentage unavailable"
                        : `${Math.round(dashboardUsageRings?.upload ?? 0)}% of limit`}
                    </Text>
                  </View>
                </View>
                <View style={styles.usageRow}>
                  <View style={styles.metricLabelContainer}>
                    {dashboardUsageRings?.total !== null && (
                      <View
                        style={[
                          styles.metricDot,
                          {
                            backgroundColor: getUsageColor(
                              dashboardUsageRings?.total ?? null,
                            ),
                          },
                        ]}
                      />
                    )}
                    <Text style={styles.usageDetailLabel}>Total Used</Text>
                  </View>
                  <View style={styles.metricValueContainer}>
                    <Text
                      style={[styles.usageDetailValue, styles.usageTotalValue]}
                    >
                      {dashboardData?.usage.current_month.total_gb.toFixed(1) ||
                        "0"}{" "}
                      GB
                    </Text>
                    {dashboardUsageRings?.total !== null && (
                      <Text style={styles.metricPercentage}>
                        {Math.round(dashboardUsageRings?.total ?? 0)}% of limit
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.usageRow}>
                  <Text style={styles.usageDetailLabel}>Package Limit</Text>
                  <Text style={styles.usageDetailValue}>
                    {dashboardData?.usage.package_details.subscription_limit ||
                      "N/A"}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Dashboard shortcuts */}
        <Card style={styles.shortcutsCard}>
          <View style={styles.shortcutsGrid}>
            {[
              { title: "View Usage", onPress: handleViewUsage },
              { title: "Pay Bill", onPress: handlePayBill },
              { title: "Support", onPress: handleSupport },
              { title: "Invoices", onPress: handleInvoices },
            ].map((action) => (
              <CustomButton
                key={action.title}
                title={action.title}
                onPress={action.onPress}
                variant="secondary"
                size="medium"
                style={styles.actionButton}
                textStyle={styles.actionButtonText}
              />
            ))}
          </View>
        </Card>

        {/* Alerts & Notifications */}
        {outagesEnabled && (dashboardData?.current_outages?.length || 0) > 0 && (
          <Card title="Service Alerts" variant="highlight">
            {dashboardData?.current_outages?.map((outage) => (
              <View key={outage.id} style={styles.alertItem}>
                <Ionicons name="warning" size={20} color={Colors.warning} />
                <View style={styles.alertContent}>
                  <Text
                    style={styles.alertTitle}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {" "}
                    {outage.title}
                  </Text>
                  <Text
                    style={styles.alertDescription}
                    numberOfLines={3}
                    ellipsizeMode="tail"
                  >
                    {outage.description}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Recent Invoices */}
        {(dashboardData?.recent_payments?.length || 0) > 0 && (
          <Card title="Recent Invoices">
            {dashboardData?.recent_payments
              .slice(0, 3)
              .map((invoice: any, index: number, invoices: any[]) => (
              <View
                key={invoice.invoice_number}
                style={[
                  styles.invoiceItem,
                  index === invoices.length - 1 && styles.lastInvoiceItem,
                ]}
              >
                <View style={styles.invoiceHeader}>
                  <Text style={styles.invoiceNumber}>
                    #{invoice.invoice_number}
                  </Text>
                  <Text
                    style={[
                      styles.invoiceStatus,
                      {
                        color:
                          invoice.status === "paid"
                            ? Colors.success
                            : Colors.warning,
                      },
                    ]}
                  >
                    {invoice.status.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.invoiceDetails}>
                  <Text style={styles.invoiceAmount}>
                    R{Number(invoice.amount).toFixed(2)}
                  </Text>
                  <Text style={styles.invoiceDate}>{invoice.date}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Bottom Ad Banner */}
        <AdBanner
          placement="dashboard_bottom"
          style={{ marginTop: Spacing.md }}
        />
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
        message={`Pay in App - Fast & secure card payment via Yoco\n\nEFT Transfer - Transfer using online banking`}
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
        message={`Account Holder: Mzanzi Lisette Media and Printing (Pty) Ltd t/a CTECG\nBank: FNB\nAccount Type: Cheque\nAccount Number: 621 441 98737\nBranch: Groblersdal\nBranch Code: 260147\n\nReference: ${dashboardData?.customer.customer_number || user?.invoicingid || "Your Client Code"}\n\nPlease use your Client Code as the payment reference.`}
        confirmText="OK"
        onConfirm={() => setShowBankingModal(false)}
        onCancel={() => setShowBankingModal(false)}
        showCancel={false}
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
  accountCard: {
    marginBottom: Spacing.md,
  },
  accountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  accountInfoContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusContainer: {
    alignItems: "flex-end",
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
    textAlign: "right",
    fontStyle: "italic",
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
  },
  packageItemSeparated: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  packageItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  packageAmountContainer: {
    alignItems: "flex-end",
  },
  vatLabel: {
    marginTop: 2,
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  packageTotalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  packageTotalVatLabel: {
    marginTop: 2,
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: "right",
  },
  usageContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  usageChart: {
    width: 120,
    height: 120,
    marginRight: Spacing.lg,
  },
  usageDetails: {
    flex: 1,
  },
  usageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  metricLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  metricValueContainer: {
    alignItems: "flex-end",
    marginLeft: Spacing.sm,
  },
  metricPercentage: {
    marginTop: 2,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  shortcutsCard: {
    padding: Spacing.sm,
  },
  shortcutsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  actionButton: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: "#FFF7F7",
    borderWidth: 1,
    borderColor: "#F2D6D6",
    shadowOpacity: 0,
    elevation: 0,
  },
  actionButtonText: {
    color: Colors.primary,
    fontSize: Typography.sm,
    letterSpacing: Typography.letterSpacing.normal,
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  invoiceItem: {
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lastInvoiceItem: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
