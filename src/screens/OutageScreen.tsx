import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TopNavigation from '../components/TopNavigation';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { showToast } from '../components/Toast';
import { Colors, Typography, CommonStyles, Spacing } from '../constants/Design';
import { apiService } from '../services/api';
import { OutageData, OutagesResponse } from '../types/api';

export default function OutageScreen() {
  const [outagesData, setOutagesData] = useState<OutagesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOutages = async () => {
    try {
      console.log('Fetching outages...');
      const response = await apiService.getOutages();
      console.log('Outages response:', response);
      
      if (response.success && response.data) {
        setOutagesData(response.data);
      } else {
        console.log('No outages data or request failed');
        setOutagesData(null);
      }
    } catch (error) {
      console.error('Error fetching outages:', error);
      showToast.error('Error', 'Failed to load outages information');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOutages();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOutages();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'ongoing': 
        return Colors.error;
      case 'scheduled':
      case 'planned': 
        return Colors.warning;
      case 'resolved':
      case 'completed': 
        return Colors.success;
      default: 
        return Colors.textMuted;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
      case 'urgent': 
        return 'warning';
      case 'high': 
        return 'alert-circle';
      case 'medium': 
        return 'information-circle';
      case 'low': 
        return 'checkmark-circle';
      default: 
        return 'information-circle';
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <TopNavigation title="Service Status" subtitle="Network outages and maintenance" />
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  const outages = outagesData?.outages || [];

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <TopNavigation title="Service Status" subtitle="Network outages and maintenance" />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {outages.length === 0 ? (
          <Card title="All Systems Operational">
            <View style={styles.noOutages}>
              <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
              <Text style={styles.noOutagesText}>
                No current outages or scheduled maintenance
              </Text>
              <Text style={styles.lastUpdated}>
                Last updated: {outagesData?.timestamp ? formatDateTime(outagesData.timestamp) : new Date().toLocaleString()}
              </Text>
            </View>
          </Card>
        ) : (
          outages.map((outage: OutageData) => (
            <View key={outage.id} style={styles.postContainer}>
              {/* Post Header - like Facebook */}
              <View style={styles.postHeader}>
                <View style={styles.avatarContainer}>
                  <Ionicons 
                    name="business" 
                    size={24} 
                    color={Colors.primary} 
                    style={styles.avatar}
                  />
                </View>
                <View style={styles.postHeaderText}>
                  <Text style={styles.posterName}>CTECG Network Status</Text>
                  <View style={styles.postMeta}>
                    <Text style={styles.postTime}>
                      {formatDateTime(outage.start_time)} · 
                    </Text>
                    <Ionicons name="globe-outline" size={12} color={Colors.textMuted} />
                  </View>
                </View>
                <View style={styles.postActions}>
                  <Ionicons 
                    name={getPriorityIcon(outage.priority)} 
                    size={20} 
                    color={getStatusColor(outage.priority)} 
                  />
                </View>
              </View>

              {/* Post Content */}
              <View style={styles.postContent}>
                <Text style={styles.postTitle}>{outage.title}</Text>
                <Text style={styles.postDescription}>{outage.description}</Text>
                
                {/* Status Badge */}
                <View style={styles.statusBadge}>
                  <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(outage.status) }]} />
                  <Text style={[styles.statusLabel, { color: getStatusColor(outage.status) }]}>
                    {outage.status?.toUpperCase() || 'UNKNOWN'}
                  </Text>
                </View>

                {/* Location and Time Info */}
                <View style={styles.postDetails}>
                  {outage.tower && (
                    <View style={styles.detailItem}>
                      <Ionicons name="location" size={14} color={Colors.textMuted} />
                      <Text style={styles.detailLabel}>
                        {outage.tower.name} - {outage.area}
                      </Text>
                    </View>
                  )}
                  {outage.estimated_end_time && (
                    <View style={styles.detailItem}>
                      <Ionicons name="time" size={14} color={Colors.textMuted} />
                      <Text style={styles.detailLabel}>
                        Estimated end: {formatDateTime(outage.estimated_end_time)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Comments Section (Updates) */}
              {outage.updates && outage.updates.length > 0 && (
                <View style={styles.commentsSection}>
                  <Text style={styles.commentsHeader}>
                    Updates ({outage.updates_count})
                  </Text>
                  {outage.updates.map((update, index) => (
                    <View key={update.id || index} style={styles.comment}>
                      <View style={styles.commentAvatar}>
                        <Ionicons name="person" size={16} color={Colors.primary} />
                      </View>
                      <View style={styles.commentContent}>
                        <View style={styles.commentBubble}>
                          <Text style={styles.commenterName}>Technical Team</Text>
                          <Text style={styles.commentText}>{update.message}</Text>
                          {update.eta_update && (
                            <Text style={styles.commentEta}>ETA: {update.eta_update}</Text>
                          )}
                        </View>
                        <View style={styles.commentMeta}>
                          <Text style={styles.commentTime}>
                            {formatDateTime(update.created_at)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}

        {/* Show site info if available */}
        {outagesData?.site_name && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Service status for: {outagesData.site_name}
            </Text>
            <Text style={styles.footerText}>
              Total outages: {outagesData.total_count || 0}
            </Text>
          </View>
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
    padding: Spacing.md,
  },
  noOutages: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  noOutagesText: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.medium,
    color: Colors.success,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  // Facebook-style post container
  postContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // Post header (like Facebook profile section)
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  avatar: {
    // Icon styles handled by Ionicons
  },
  postHeaderText: {
    flex: 1,
  },
  posterName: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  postTime: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  postActions: {
    padding: Spacing.xs,
  },
  // Post content
  postContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  postTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.weights.medium,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  postDescription: {
    fontSize: Typography.md,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 16,
    marginBottom: Spacing.sm,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  statusLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
  },
  postDetails: {
    gap: Spacing.xs,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailLabel: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  // Comments section (updates)
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.md,
  },
  commentsHeader: {
    fontSize: Typography.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  comment: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  commenterName: {
    fontSize: Typography.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: 2,
  },
  commentText: {
    fontSize: Typography.sm,
    color: Colors.text,
    lineHeight: 18,
  },
  commentEta: {
    fontSize: Typography.xs,
    color: Colors.primary,
    marginTop: Spacing.xs,
    fontWeight: Typography.weights.medium,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.sm,
  },
  commentTime: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  footer: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
