import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TopNavigation from '../components/TopNavigation';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import AdBanner from '../components/AdBanner';
import { showToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { DetailedUsageData } from '../types/api';
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

export default function UsageScreen() {
  const { user } = useAuth();
  const [usageData, setUsageData] = useState<DetailedUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper function to determine if plan is uncapped
  const isUncappedPlan = (packageInfo: any) => {
    // Only consider it uncapped if explicitly marked as uncapped
    // Don't assume uncapped just because limit_gb is null (could be missing data)
    return packageInfo.is_uncapped === true || 
           packageInfo.code?.toLowerCase().includes('uncapped') ||
           packageInfo.name?.toLowerCase().includes('uncapped') ||
           packageInfo.name?.toLowerCase().includes('unlimited') ||
           packageInfo.name?.toLowerCase().includes('u++');
  };

  useEffect(() => {
    if (user) {
      console.log('User changed, clearing usage data and reloading for:', user.invoicingid);
      setUsageData(null);
      loadUsageData();
    }
  }, [user]);

  const loadUsageData = async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      console.log('Loading detailed usage data...');
      const response = await apiService.getDetailedUsageData();
      console.log('Usage API response:', response);
      
      if (response.success && response.data) {
        console.log('Setting usage data:', response.data);
        setUsageData(response.data);
      } else {
        console.error('Usage API error:', response.message);
        showToast.error('Error', response.message || 'Failed to load usage data');
      }
    } catch (error) {
      console.error('Usage load error:', error);
      showToast.error('Error', 'Failed to load usage data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadUsageData(true);
  };

  const getUsageColor = (percentage: number | null) => {
    if (percentage === null) return Colors.primary;
    if (percentage >= 95) return Colors.error;
    if (percentage >= 85) return '#EA580C';
    if (percentage >= 70) return '#D97706';
    if (percentage >= 50) return '#CA8A04';
    if (percentage >= 25) return Colors.success;
    return '#059669';
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
        {/* Ad Banner */}
        <AdBanner placement="usage" style={{ marginBottom: Spacing.md }} />

        {/* Usage Summary */}
        <Card title="Current Month Usage" subtitle={`${summary.billing_period.period_start} to ${summary.billing_period.period_end}`}>
          <View style={styles.usageOverview}>
            <View style={styles.usageChart}>
              <View style={styles.usageCircle}>
                <View 
                  style={[
                    styles.usageProgress,
                    {
                      backgroundColor: getUsageColor(summary.package_info.percentage_used),
                      height: summary.package_info.percentage_used !== null ? `${Math.min(summary.package_info.percentage_used, 100)}%` : '0%',
                    }
                  ]} 
                />
                <View style={styles.usageContent}>
                  <Text style={[styles.usagePercentage, { color: getUsageColor(summary.package_info.percentage_used) }]}>
                    {isUncappedPlan(summary.package_info) ? 'Unlimited' : 
                     summary.package_info.percentage_used !== null ? `${Math.round(summary.package_info.percentage_used)}%` : 'N/A'}
                  </Text>
                  <Text style={styles.usageLabel}>
                    {isUncappedPlan(summary.package_info) ? 'Data' : summary.package_info.percentage_used !== null ? 'Used' : 'Usage'}
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.usageDetails}>
              <View style={styles.usageRow}>
                <Text style={styles.usageDetailLabel}>Downloaded</Text>
                <Text style={styles.usageDetailValue}>
                  {summary.total_usage.download_gb.toFixed(1)} GB
                </Text>
              </View>
              <View style={styles.usageRow}>
                <Text style={styles.usageDetailLabel}>Uploaded</Text>
                <Text style={styles.usageDetailValue}>
                  {summary.total_usage.upload_gb.toFixed(1)} GB
                </Text>
              </View>
              <View style={styles.usageRow}>
                <Text style={styles.usageDetailLabel}>Total Used</Text>
                <Text style={[styles.usageDetailValue, styles.usageTotalValue]}>
                  {summary.total_usage.total_gb.toFixed(1)} GB
                </Text>
              </View>
              <View style={styles.usageRow}>
                <Text style={styles.usageDetailLabel}>
                  {isUncappedPlan(summary.package_info) ? 'Plan Type' : 'Package Limit'}
                </Text>
                <Text style={styles.usageDetailValue}>
                  {isUncappedPlan(summary.package_info) ? 'Unlimited' : 
                   summary.package_info.limit_gb ? `${summary.package_info.limit_gb} GB` : 'Not Set'}
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
                  <View key={index} style={[styles.packageItem, index > 0 && styles.packageItemBorder]}>
                    <View style={styles.packageRow}>
                      <Text style={styles.packageLabel}>Package {index + 1}</Text>
                      <Text style={styles.packageValueBold}>{pkg.code || cleanSubscriptionName(pkg.name)}</Text>
                    </View>
                    <View style={styles.packageRow}>
                      <Text style={styles.packageLabelSecondary}>{cleanSubscriptionName(pkg.name)}</Text>
                      <Text style={styles.packageValueAmount}>{pkg.formatted_amount}</Text>
                    </View>
                    {pkg.traffic_cap && (
                      <Text style={styles.packageCapInfo}>
                        Data Cap: {parseFloat(pkg.traffic_cap) > 0 ? parseFloat(pkg.traffic_cap).toFixed(0) + ' GB' : 'Uncapped'}
                      </Text>
                    )}
                  </View>
                ))}
                {summary.packages.length > 1 && (
                  <View style={[styles.packageRow, styles.totalRow]}>
                    <Text style={styles.packageLabelBold}>Total Monthly Amount</Text>
                    <Text style={styles.packageValueTotal}>
                      {summary.package_info.formatted_total_amount || 'R' + summary.package_info.total_monthly_amount?.toFixed(2)}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <View style={styles.packageRow}>
                  <Text style={styles.packageLabel}>Plan Name</Text>
                  <Text style={styles.packageValue}>{summary.package_info.code || cleanSubscriptionName(summary.package_info.name)}</Text>
                </View>
                <View style={styles.packageRow}>
                  <Text style={styles.packageLabel}>Monthly Amount</Text>
                  <Text style={styles.packageValue}>R{summary.package_info.package_amount.toFixed(2)}</Text>
                </View>
              </>
            )}
            <View style={styles.packageRow}>
              <Text style={styles.packageLabel}>Speed</Text>
              <Text style={styles.packageValue}>{summary.package_info.speed_description}</Text>
            </View>
            <View style={styles.packageRow}>
              <Text style={styles.packageLabel}>Billing Period</Text>
              <Text style={styles.packageValue}>
                {summary.billing_period.days_elapsed} of {new Date(summary.billing_period.period_end).getDate()} days used
              </Text>
            </View>
          </View>
        </Card>

        {/* Usage Breakdown */}
        <Card title="Usage Breakdown" subtitle="Different time periods">
          <View style={styles.dailyUsage}>
            {/* Today (d1) */}
            <View style={styles.dailyItem}>
              <Text style={styles.dailyDate}>Today</Text>
              <View style={styles.dailyBar}>
                <View style={styles.dailyBarBackground}>
                  <View 
                    style={[
                      styles.dailyBarFill,
                      { 
                        width: usageData.raw_data?.usage_object?.d1down ? 
                          `${Math.min(((usageData.raw_data.usage_object.d1down + usageData.raw_data.usage_object.d1up) / (1024 * 1024 * 1024)) * 5, 100)}%` : '2%',
                        backgroundColor: Colors.primary
                      }
                    ]} 
                  />
                </View>
              </View>
              <Text style={styles.dailyAmount}>
                {((usageData.raw_data?.usage_object?.d1down || 0) + (usageData.raw_data?.usage_object?.d1up || 0)) > 1024 * 1024 * 1024 ? 
                  `${(((usageData.raw_data?.usage_object?.d1down || 0) + (usageData.raw_data?.usage_object?.d1up || 0)) / (1024 * 1024 * 1024)).toFixed(1)} GB` : 
                  `${(((usageData.raw_data?.usage_object?.d1down || 0) + (usageData.raw_data?.usage_object?.d1up || 0)) / (1024 * 1024)).toFixed(0)} MB`}
              </Text>
            </View>

            {/* Yesterday (d2) */}
            <View style={styles.dailyItem}>
              <Text style={styles.dailyDate}>Yesterday</Text>
              <View style={styles.dailyBar}>
                <View style={styles.dailyBarBackground}>
                  <View 
                    style={[
                      styles.dailyBarFill,
                      { 
                        width: usageData.raw_data?.usage_object?.d2down ? 
                          `${Math.min(((usageData.raw_data.usage_object.d2down + usageData.raw_data.usage_object.d2up) / (1024 * 1024 * 1024)) * 5, 100)}%` : '2%',
                        backgroundColor: Colors.primary
                      }
                    ]} 
                  />
                </View>
              </View>
              <Text style={styles.dailyAmount}>
                {((usageData.raw_data?.usage_object?.d2down || 0) + (usageData.raw_data?.usage_object?.d2up || 0)) > 1024 * 1024 * 1024 ? 
                  `${(((usageData.raw_data?.usage_object?.d2down || 0) + (usageData.raw_data?.usage_object?.d2up || 0)) / (1024 * 1024 * 1024)).toFixed(1)} GB` : 
                  `${(((usageData.raw_data?.usage_object?.d2down || 0) + (usageData.raw_data?.usage_object?.d2up || 0)) / (1024 * 1024)).toFixed(0)} MB`}
              </Text>
            </View>

            {/* This Week */}
            <View style={styles.dailyItem}>
              <Text style={styles.dailyDate}>This Week</Text>
              <View style={styles.dailyBar}>
                <View style={styles.dailyBarBackground}>
                  <View 
                    style={[
                      styles.dailyBarFill,
                      { 
                        width: usageData.raw_data?.usage_object?.weekdown ? 
                          `${Math.min(((usageData.raw_data.usage_object.weekdown + usageData.raw_data.usage_object.weekup) / (1024 * 1024 * 1024)) * 2, 100)}%` : '2%',
                        backgroundColor: Colors.primary
                      }
                    ]} 
                  />
                </View>
              </View>
              <Text style={styles.dailyAmount}>
                {((usageData.raw_data?.usage_object?.weekdown || 0) + (usageData.raw_data?.usage_object?.weekup || 0)) > 1024 * 1024 * 1024 ? 
                  `${(((usageData.raw_data?.usage_object?.weekdown || 0) + (usageData.raw_data?.usage_object?.weekup || 0)) / (1024 * 1024 * 1024)).toFixed(1)} GB` : 
                  `${(((usageData.raw_data?.usage_object?.weekdown || 0) + (usageData.raw_data?.usage_object?.weekup || 0)) / (1024 * 1024)).toFixed(0)} MB`}
              </Text>
            </View>
          </View>
        </Card>

        {/* Usage Trends */}
        <Card title="Usage Trends">
          <View style={styles.trendsContainer}>
            <View style={styles.trendItem}>
              <Text style={styles.trendLabel}>Weekly Total</Text>
              <Text style={styles.trendValue}>
                {(usage_trends.weekly_total.total_mb / 1024).toFixed(1)} GB
              </Text>
            </View>
            <View style={styles.trendItem}>
              <Text style={styles.trendLabel}>Daily Average</Text>
              <Text style={styles.trendValue}>
                {(usage_trends.average_daily.total_mb).toFixed(0)} MB
              </Text>
            </View>
          </View>
        </Card>

        {/* Alerts */}
        {(alerts.high_usage || alerts.approaching_limit || alerts.over_limit) && (
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
                <Ionicons name="warning-outline" size={20} color={Colors.warning} />
                <Text style={[styles.alertText, { color: Colors.warning }]}>
                  You are approaching your data limit
                </Text>
              </View>
            )}
            {alerts.high_usage && !alerts.approaching_limit && (
              <View style={styles.alertItem}>
                <Ionicons name="information-circle" size={20} color={Colors.primary} />
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  comingSoon: {
    fontSize: Typography.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  usageOverview: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  packageValueTotal: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  packageCapInfo: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  dailyUsage: {
    marginTop: Spacing.sm,
  },
  dailyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  dailyDate: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    width: 80,
  },
  dailyBar: {
    flex: 1,
    marginHorizontal: Spacing.sm,
  },
  dailyBarBackground: {
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dailyBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  dailyAmount: {
    fontSize: Typography.xs,
    color: Colors.text,
    width: 60,
    textAlign: 'right',
  },
  trendsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.sm,
  },
  trendItem: {
    alignItems: 'center',
  },
  trendLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  trendValue: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
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
});
