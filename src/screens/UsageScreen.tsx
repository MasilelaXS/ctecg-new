import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import TopNavigation from "../components/TopNavigation";
import Card from "../components/Card";
import DataUsageGauge, {
  getUsageColor,
  USAGE_RING_COLORS,
} from "../components/DataUsageGauge";
import LoadingSpinner from "../components/LoadingSpinner";
import AdBanner from "../components/AdBanner";
import CachedDataNotice from "../components/CachedDataNotice";
import { showToast } from "../components/Toast";
import { useAuth } from "../contexts/AuthContext";
import { apiService } from "../services/api";
import { DetailedUsageData } from "../types/api";
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

const hasPackageCode = (code: string | null | undefined): code is string => {
  if (!code) return false;

  const normalizedCode = code.trim().toLowerCase();
  return normalizedCode !== "n/a" && normalizedCode !== "unknown";
};

export default function UsageScreen() {
  const { user } = useAuth();
  const [usageData, setUsageData] = useState<DetailedUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const accountRequestGeneration = useRef(0);

  // Helper function to determine if plan is uncapped
  const isUncappedPlan = (packageInfo: any) => {
    // Only consider it uncapped if explicitly marked as uncapped
    // Don't assume uncapped just because limit_gb is null (could be missing data)
    return (
      packageInfo.is_uncapped === true ||
      packageInfo.code?.toLowerCase().includes("uncapped") ||
      packageInfo.name?.toLowerCase().includes("uncapped") ||
      packageInfo.name?.toLowerCase().includes("unlimited") ||
      packageInfo.name?.toLowerCase().includes("u++")
    );
  };

  useEffect(() => {
    const requestGeneration = ++accountRequestGeneration.current;
    if (user) {
      console.log(
        "User changed, clearing usage data and reloading for:",
        user.invoicingid,
      );
      setUsageData(null);
      setCachedAt(null);
      void loadUsageData(false, requestGeneration);
    }
  }, [user]);

  const loadUsageData = async (
    isRefresh = false,
    requestGeneration = accountRequestGeneration.current,
  ) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      console.log("Loading detailed usage data...");
      const response = await apiService.getDetailedUsageData();
      if (requestGeneration !== accountRequestGeneration.current) return;
      console.log("Usage API response:", response);

      if (response.success && response.data) {
        console.log("Setting usage data:", response.data);
        setUsageData(response.data);
        setCachedAt(response.meta?.source === "cache" ? response.meta.cached_at || null : null);
      } else {
        console.error("Usage API error:", response.message);
        showToast.error(
          "Error",
          response.message || "Failed to load usage data",
        );
      }
    } catch (error) {
      if (requestGeneration !== accountRequestGeneration.current) return;
      console.error("Usage load error:", error);
      showToast.error("Error", "Failed to load usage data");
    } finally {
      if (requestGeneration === accountRequestGeneration.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  const onRefresh = () => {
    loadUsageData(true);
  };

  const getDayLabel = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const formatUsageValue = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${Math.round(mb)} MB`;
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading usage data..." />;
  }

  if (!usageData) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <TopNavigation title="Usage" subtitle="Monitor your data usage" />
        <View style={styles.content}>
          <Text style={styles.comingSoon}>No usage data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { summary, daily_breakdown, usage_trends, alerts } = usageData;
  const isUnlimited = isUncappedPlan(summary.package_info);
  const ringPercentages = calculateUsageRingPercentages(
    summary.total_usage.download_gb,
    summary.total_usage.upload_gb,
    summary.total_usage.total_gb,
    summary.package_info.limit_gb,
    isUnlimited,
  );
  const ringContext = ringPercentages.mode === "limit" ? "of limit" : "of traffic";
  const dailyCards = [...daily_breakdown].reverse();
  const periodTotals = [
    ...(usage_trends.weekly_total.has_data !== false
      ? [
          {
            key: "this_week",
            label: "This Week",
            valueGb: usage_trends.weekly_total.total_mb / 1024,
            color: Colors.primary,
          },
        ]
      : []),
    {
      key: "current_month",
      label: "This Month",
      valueGb: summary.total_usage.total_gb,
      color: "#F59E0B",
    },
  ];
  const maxPeriodGb = Math.max(
    1,
    ...periodTotals.map((period) => period.valueGb),
  );

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <TopNavigation title="Usage" subtitle="Monitor your data usage" />

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
        {/* Ad Banner */}
        <AdBanner placement="usage" style={{ marginBottom: Spacing.md }} />

        {/* Usage Summary */}
        <Card
          title="Current Month Usage"
          subtitle={`${summary.billing_period.period_start} to ${summary.billing_period.period_end}`}
        >
          <View style={styles.usageOverview}>
            <View style={styles.usageChart}>
              <DataUsageGauge
                percentage={ringPercentages.total}
                downloadPercentage={ringPercentages.download}
                uploadPercentage={ringPercentages.upload}
                isUnlimited={isUnlimited}
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
                    {summary.total_usage.download_gb.toFixed(1)} GB
                  </Text>
                  <Text style={styles.metricPercentage}>
                    {ringPercentages.total === null && !isUnlimited
                      ? "Percentage unavailable"
                      : `${Math.round(ringPercentages.download)}% ${ringContext}`}
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
                    {summary.total_usage.upload_gb.toFixed(1)} GB
                  </Text>
                  <Text style={styles.metricPercentage}>
                    {ringPercentages.total === null && !isUnlimited
                      ? "Percentage unavailable"
                      : `${Math.round(ringPercentages.upload)}% ${ringContext}`}
                  </Text>
                </View>
              </View>
              <View style={styles.usageRow}>
                <View style={styles.metricLabelContainer}>
                  {!isUnlimited && ringPercentages.total !== null && (
                    <View
                      style={[
                        styles.metricDot,
                        { backgroundColor: getUsageColor(ringPercentages.total) },
                      ]}
                    />
                  )}
                  <Text style={styles.usageDetailLabel}>Total Used</Text>
                </View>
                <View style={styles.metricValueContainer}>
                  <Text style={[styles.usageDetailValue, styles.usageTotalValue]}>
                    {summary.total_usage.total_gb.toFixed(1)} GB
                  </Text>
                  {!isUnlimited && ringPercentages.total !== null && (
                    <Text style={styles.metricPercentage}>
                      {Math.round(ringPercentages.total)}% of limit
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.usageRow}>
                <Text style={styles.usageDetailLabel}>
                  {isUnlimited
                    ? "Plan Type"
                    : "Package Limit"}
                </Text>
                <Text style={styles.usageDetailValue}>
                  {isUnlimited
                    ? "Unlimited"
                    : summary.package_info.limit_gb
                      ? `${summary.package_info.limit_gb} GB`
                      : "Not Set"}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Package Information */}
        <Card title="Package Details">
          <View style={styles.packageInfo}>
            {summary.packages && summary.packages.length > 0 ? (
              <>
                {summary.packages.map((pkg, index) => (
                  <View
                    key={index}
                    style={[
                      styles.packageItem,
                      index > 0 && styles.packageItemBorder,
                    ]}
                  >
                    <View style={styles.packageRow}>
                      <Text style={styles.packageLabel}>
                        Package {index + 1}
                      </Text>
                      <Text style={styles.packageValueBold}>
                        {hasPackageCode(pkg.code)
                          ? pkg.code
                          : cleanSubscriptionName(pkg.name)}
                      </Text>
                    </View>
                    <View style={styles.packageRow}>
                      <Text style={styles.packageLabelSecondary}>
                        {cleanSubscriptionName(pkg.name)}
                      </Text>
                      <Text style={styles.packageValueAmount}>
                        {pkg.formatted_amount}
                      </Text>
                    </View>
                    <Text style={styles.packageVatLabel}>Price includes VAT</Text>
                    {pkg.traffic_cap && (
                      <Text style={styles.packageCapInfo}>
                        Data Cap:{" "}
                        {parseFloat(pkg.traffic_cap) > 0
                          ? parseFloat(pkg.traffic_cap).toFixed(0) + " GB"
                          : "Uncapped"}
                      </Text>
                    )}
                  </View>
                ))}
                {summary.packages.length > 1 && (
                  <View style={[styles.packageRow, styles.totalRow]}>
                    <Text style={styles.packageLabelBold}>
                      Total Monthly Amount
                    </Text>
                    <Text style={styles.packageValueTotal}>
                      {summary.package_info.formatted_total_amount ||
                        "R" +
                          summary.package_info.total_monthly_amount?.toFixed(2)}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <View style={styles.packageRow}>
                  <Text style={styles.packageLabel}>Plan Name</Text>
                  <Text style={styles.packageValue}>
                    {hasPackageCode(summary.package_info.code)
                      ? summary.package_info.code
                      : cleanSubscriptionName(summary.package_info.name)}
                  </Text>
                </View>
                <View style={styles.packageRow}>
                  <Text style={styles.packageLabel}>Monthly Amount</Text>
                  <Text style={styles.packageValue}>
                    R{summary.package_info.package_amount.toFixed(2)}
                  </Text>
                </View>
              </>
            )}
            <View style={styles.packageRow}>
              <Text style={styles.packageLabel}>Speed</Text>
              <Text style={styles.packageValue}>
                {summary.package_info.speed_description}
              </Text>
            </View>
            <View style={styles.packageRow}>
              <Text style={styles.packageLabel}>Billing Period</Text>
              <Text style={styles.packageValue}>
                {summary.billing_period.days_elapsed} of{" "}
                {new Date(summary.billing_period.period_end).getDate()} days
                used
              </Text>
            </View>
          </View>
        </Card>

        {/* Daily and period usage */}
        <Card
          title="Usage Breakdown"
          subtitle="Daily, weekly and monthly counters"
        >
          <View style={styles.usageBreakdownSection}>
            <Text style={styles.usageBreakdownTitle}>
              {dailyCards.length} Day{dailyCards.length === 1 ? "" : "s"}{" "}
              Summary
            </Text>
            <View style={styles.dailyCardsRow}>
              {dailyCards.map((day) => (
                <View key={day.date} style={styles.dayCard}>
                  <View style={styles.dayCardHeader}>
                    <Text style={styles.dayCardLabel}>{day.label}</Text>
                    <Text style={styles.dayCardDate}>{day.date}</Text>
                  </View>
                  <Text style={styles.dayCardTotal}>
                    {formatUsageValue(day.total_mb)}
                  </Text>
                  <View style={styles.dayCardSplit}>
                    <Text style={styles.dayCardSplitText}>
                      Down {formatUsageValue(day.download_mb)}
                    </Text>
                    <Text style={styles.dayCardSplitText}>
                      Up {formatUsageValue(day.upload_mb)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.usageBreakdownDivider} />

          <View style={styles.usageBreakdownSection}>
            <Text style={styles.usageBreakdownTitle}>Period Comparison</Text>
            <View style={styles.trendsContainer}>
              {periodTotals.map((period) => {
                const widthPercent = Math.max(
                  (period.valueGb / maxPeriodGb) * 100,
                  6,
                );
                return (
                  <View key={period.key} style={styles.periodRow}>
                    <View style={styles.periodHeader}>
                      <Text style={styles.trendLabel}>{period.label}</Text>
                      <Text style={styles.trendValue}>
                        {period.valueGb.toFixed(1)} GB
                      </Text>
                    </View>
                    <View style={styles.periodTrack}>
                      <View
                        style={[
                          styles.periodFill,
                          {
                            width: `${Math.min(widthPercent, 100)}%`,
                            backgroundColor: period.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </Card>

        {/* Alerts */}
        {(alerts.high_usage ||
          alerts.approaching_limit ||
          alerts.over_limit) && (
          <Card title="Usage Alerts" variant="highlight">
            {alerts.over_limit && (
              <View style={styles.alertItem}>
                <Ionicons name="warning" size={20} color={Colors.error} />
                <Text style={[styles.alertText, { color: Colors.error }]}>
                  You have exceeded your data limit
                </Text>
              </View>
            )}
            {alerts.approaching_limit && !alerts.over_limit && (
              <View style={styles.alertItem}>
                <Ionicons
                  name="warning-outline"
                  size={20}
                  color={Colors.warning}
                />
                <Text style={[styles.alertText, { color: Colors.warning }]}>
                  You are approaching your data limit
                </Text>
              </View>
            )}
            {alerts.high_usage && !alerts.approaching_limit && (
              <View style={styles.alertItem}>
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={[styles.alertText, { color: Colors.primary }]}>
                  High usage detected this month
                </Text>
              </View>
            )}
          </Card>
        )}
      </ScrollView>
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  comingSoon: {
    fontSize: Typography.lg,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  usageOverview: {
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
  packageInfo: {
    marginTop: Spacing.sm,
  },
  packageItem: {
    marginBottom: Spacing.md,
  },
  packageItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  packageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  packageLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  packageLabelSecondary: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    flex: 1,
  },
  packageLabelBold: {
    fontSize: Typography.md,
    color: Colors.text,
    fontWeight: Typography.weights.bold,
  },
  packageValue: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  packageValueBold: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  packageValueAmount: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
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
  packageVatLabel: {
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: "right",
  },
  packageValueTotal: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  packageCapInfo: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontStyle: "italic",
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  graphContainer: {
    marginTop: Spacing.sm,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  chartContainer: {
    width: "100%",
    paddingVertical: Spacing.md,
  },
  chartLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  barChartWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 180,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  barColumn: {
    alignItems: "center",
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  barValue: {
    height: 24,
    justifyContent: "flex-start",
    marginBottom: Spacing.xs,
  },
  barValueText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  barContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: "hidden",
    minHeight: 8,
    justifyContent: "flex-end",
  },
  barSegment: {
    width: "100%",
  },
  barLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontWeight: Typography.weights.semibold,
  },
  detailedList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  detailedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailedDate: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  detailedDateFull: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  detailedValues: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  detailedValueItem: {
    alignItems: "center",
  },
  totalValueItem: {
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.backgroundAlt,
  },
  detailedValueLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  detailedValue: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  totalValue: {
    color: Colors.primary,
  },
  chartAxisText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  dailyUsageList: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  dailyItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dailyDate: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  dailyAmount: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
  },
  dailyCardsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  usageBreakdownSection: {
    gap: Spacing.md,
  },
  usageBreakdownTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  usageBreakdownDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  dayCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
  },
  dayCardHeader: {
    marginBottom: Spacing.sm,
  },
  dayCardLabel: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  dayCardDate: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dayCardTotal: {
    fontSize: Typography.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  dayCardSplit: {
    gap: Spacing.xs,
  },
  dayCardSplitText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  trendsContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  periodRow: {
    gap: Spacing.xs,
  },
  periodHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  periodTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  periodFill: {
    height: "100%",
    borderRadius: 999,
  },
  trendLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  trendValue: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  dailyAverageBanner: {
    marginTop: Spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  dailyAverageText: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  alertText: {
    fontSize: Typography.sm,
    marginLeft: Spacing.sm,
    flex: 1,
  },
});
