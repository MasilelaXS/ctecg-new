import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import TopNavigation from '../components/TopNavigation';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { showToast } from '../components/Toast';
import { Colors, Typography, Spacing } from '../constants/Design';
import { apiService } from '../services/api';

type RouteParams = {
  OutageDetails: {
    notification: {
      notification_id: number;
      ticket_id: number;
      tower_name: string;
      status: 'open' | 'closed';
      created_at: string;
      closed_at?: string;
      expires_at?: string;
      updates: Array<{
        id: number;
        message: string;
        update_type: 'initial' | 'update' | 'restoration';
        created_at: string;
      }>;
    };
  };
};

export default function OutageDetailsScreen() {
  const route = useRoute<RouteProp<RouteParams, 'OutageDetails'>>();
  const { notification } = route.params;
  const [refreshing, setRefreshing] = useState(false);
  const [currentNotification, setCurrentNotification] = useState(notification);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Fetch updated notification data
      const response = await apiService.getOutageNotifications();
      if (response.success && response.data?.notifications) {
        const updated = response.data.notifications.find(
          (n: any) => n.ticket_id === currentNotification.ticket_id
        );
        if (updated) {
          setCurrentNotification(updated);
        }
      }
    } catch (error) {
      console.error('Failed to refresh outage details:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-ZA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUpdateTypeColor = (type: string) => {
    switch (type) {
      case 'initial':
        return Colors.error;
      case 'update':
        return Colors.warning;
      case 'restoration':
        return Colors.success;
      default:
        return Colors.textMuted;
    }
  };

  const getUpdateTypeIcon = (type: string) => {
    switch (type) {
      case 'initial':
        return 'alert-circle';
      case 'update':
        return 'information-circle';
      case 'restoration':
        return 'checkmark-circle';
      default:
        return 'ellipse';
    }
  };

  const getUpdateTypeLabel = (type: string) => {
    switch (type) {
      case 'initial':
        return 'OUTAGE REPORTED';
      case 'update':
        return 'UPDATE';
      case 'restoration':
        return 'SERVICE RESTORED';
      default:
        return type.toUpperCase();
    }
  };

  const isResolved = currentNotification.status === 'closed';

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <TopNavigation 
        title="Outage Details" 
        subtitle={currentNotification.tower_name}
        showBackButton={true}
        showBack 
      />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Status Header */}
        <Card variant="highlight" style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Ionicons
              name={isResolved ? 'checkmark-circle' : 'alert-circle'}
              size={32}
              color={isResolved ? Colors.success : Colors.error}
            />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {isResolved ? 'Service Restored' : 'Active Outage'}
              </Text>
              <Text style={styles.towerName}>{currentNotification.tower_name}</Text>
            </View>
          </View>
          
          <View style={styles.statusDetails}>
            <View style={styles.statusRow}>
              <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.statusText}>
                Started: {formatDateTime(currentNotification.created_at)}
              </Text>
            </View>
            
            {isResolved && currentNotification.closed_at && (
              <View style={styles.statusRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                <Text style={styles.statusText}>
                  Restored: {formatDateTime(currentNotification.closed_at)}
                </Text>
              </View>
            )}
            
            {currentNotification.expires_at && (
              <View style={styles.statusRow}>
                <Ionicons name="hourglass-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.statusText}>
                  Notification expires: {formatDateTime(currentNotification.expires_at)}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Updates Thread */}
        <Card title="Updates" subtitle={`${currentNotification.updates.length} total`}>
          <View style={styles.thread}>
            {currentNotification.updates.map((update, index) => (
              <View key={update.id} style={styles.updateItem}>
                {/* Timeline Line */}
                {index < currentNotification.updates.length - 1 && (
                  <View 
                    style={[
                      styles.timelineLine, 
                      { backgroundColor: getUpdateTypeColor(currentNotification.updates[index + 1].update_type) + '40' }
                    ]} 
                  />
                )}
                
                {/* Update Content */}
                <View style={styles.updateContent}>
                  <View 
                    style={[
                      styles.updateIconContainer,
                      { backgroundColor: getUpdateTypeColor(update.update_type) + '20' }
                    ]}
                  >
                    <Ionicons
                      name={getUpdateTypeIcon(update.update_type)}
                      size={20}
                      color={getUpdateTypeColor(update.update_type)}
                    />
                  </View>
                  
                  <View style={styles.updateBody}>
                    <View style={styles.updateHeader}>
                      <Text 
                        style={[
                          styles.updateType,
                          { color: getUpdateTypeColor(update.update_type) }
                        ]}
                      >
                        {getUpdateTypeLabel(update.update_type)}
                      </Text>
                      <Text style={styles.updateTime}>
                        {formatDateTime(update.created_at)}
                      </Text>
                    </View>
                    
                    <Text style={styles.updateMessage}>{update.message}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Info Card */}
        <Card variant="secondary" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              {isResolved
                ? 'This notification will automatically disappear 2 hours after restoration.'
                : 'We are working to restore service as quickly as possible. Updates will be posted here.'}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  statusCard: {
    margin: Spacing.md,
    marginBottom: Spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    ...Typography.bodyLargeBold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  towerName: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  statusDetails: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  thread: {
    gap: Spacing.sm,
  },
  updateItem: {
    position: 'relative',
    paddingBottom: Spacing.md,
  },
  timelineLine: {
    position: 'absolute',
    left: 19,
    top: 40,
    bottom: 0,
    width: 2,
  },
  updateContent: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  updateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateBody: {
    flex: 1,
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  updateType: {
    ...Typography.bodySmallBold,
    fontWeight: '700',
  },
  updateTime: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  updateMessage: {
    ...Typography.bodyMedium,
    color: Colors.text,
    lineHeight: 22,
  },
  infoCard: {
    margin: Spacing.md,
    marginTop: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  infoText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 20,
  },
});
