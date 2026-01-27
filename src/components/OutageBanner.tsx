import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../constants/Design';

interface OutageBannerProps {
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
  onPress?: () => void;
  onDismiss?: () => void;
  style?: ViewStyle;
}

export default function OutageBanner({ notification, onPress, onDismiss, style }: OutageBannerProps) {
  const isResolved = notification.status === 'closed';
  const latestUpdate = notification.updates[notification.updates.length - 1];
  
  const getStatusColor = () => {
    if (isResolved) return Colors.success;
    return Colors.error;
  };

  const getStatusIcon = () => {
    if (isResolved) return 'checkmark-circle';
    return 'alert-circle';
  };

  const getStatusText = () => {
    if (isResolved) return 'RESTORED';
    return 'OUTAGE';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: `${getStatusColor()}15` },
        style
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.statusRow}>
            <Ionicons name={getStatusIcon()} size={20} color={getStatusColor()} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.towerName}>{notification.tower_name}</Text>
        
        <Text style={styles.message} numberOfLines={2} ellipsizeMode="tail">
          {latestUpdate?.message || 'Service interruption detected'}
        </Text>
        
        <View style={styles.footer}>
          <Text style={styles.timeText}>
            {isResolved 
              ? `Restored ${formatTimeAgo(notification.closed_at || notification.created_at)}`
              : `Started ${formatTimeAgo(notification.created_at)}`
            }
          </Text>
          {notification.updates.length > 1 && (
            <View style={styles.updatesBadge}>
              <Text style={styles.updatesText}>{notification.updates.length} updates</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  content: {
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusText: {
    ...Typography.bodySmallBold,
    fontWeight: '700',
  },
  towerName: {
    ...Typography.bodyLargeBold,
    color: Colors.text,
  },
  message: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  timeText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  updatesBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  updatesText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
  },
});
